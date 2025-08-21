import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
export const router = Router();
const prisma = new PrismaClient();
// SSE clients
const sseClients = new Set();
export function sseInit(server) {
    server.on('close', () => {
        for (const res of sseClients) {
            try {
                res.end();
            }
            catch { }
        }
        sseClients.clear();
    });
}
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const anyRes = res;
    if (typeof anyRes.flushHeaders === 'function')
        anyRes.flushHeaders();
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});
function sseBroadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        res.write(payload);
    }
}
const IngestSchema = z.object({
    projectKey: z.string().min(1),
    run: z.object({
        suite: z.string().min(1),
        env: z.string().optional(),
        branch: z.string().optional(),
        commit: z.string().optional(),
        ciBuildId: z.string().optional(),
        startedAt: z.string().datetime(),
        finishedAt: z.string().datetime().optional(),
        coveragePct: z.number().optional()
    }),
    cases: z.array(z.object({
        name: z.string(),
        status: z.enum(['passed', 'failed', 'skipped']),
        durationMs: z.number().int().nonnegative(),
        errorMessage: z.string().optional(),
        browser: z.string().optional(),
        tags: z.array(z.string()).optional()
    })).default([])
});
router.post('/results', async (req, res) => {
    const parse = IngestSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() });
    }
    const { projectKey, run, cases } = parse.data;
    const project = await prisma.project.upsert({
        where: { key: projectKey },
        create: { key: projectKey },
        update: {}
    });
    const startedAt = new Date(run.startedAt);
    const finishedAt = run.finishedAt ? new Date(run.finishedAt) : undefined;
    let pass = 0, fail = 0, skip = 0;
    for (const c of cases) {
        if (c.status === 'passed')
            pass++;
        else if (c.status === 'failed')
            fail++;
        else
            skip++;
    }
    const durationMs = finishedAt && startedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : cases.reduce((sum, c) => sum + c.durationMs, 0);
    const createdRun = await prisma.testRun.create({
        data: {
            projectId: project.id,
            suite: run.suite,
            env: run.env,
            branch: run.branch,
            commit: run.commit,
            ciBuildId: run.ciBuildId,
            startedAt,
            finishedAt,
            durationMs,
            coveragePct: run.coveragePct,
            passCount: pass,
            failCount: fail,
            skipCount: skip,
            totalCount: cases.length,
            cases: {
                create: cases.map(c => ({
                    name: c.name,
                    status: c.status,
                    durationMs: c.durationMs,
                    errorMessage: c.errorMessage,
                    browser: c.browser,
                    tagsJson: c.tags ? JSON.stringify(c.tags) : undefined
                }))
            }
        }
    });
    sseBroadcast('run.created', { runId: createdRun.id, projectKey });
    return res.json({
        runId: createdRun.id,
        totals: {
            pass: createdRun.passCount,
            fail: createdRun.failCount,
            skip: createdRun.skipCount,
            total: createdRun.totalCount
        }
    });
});
router.get('/kpis/summary', async (req, res) => {
    const { projectKey } = req.query;
    const project = projectKey ? await prisma.project.findUnique({ where: { key: projectKey } }) : null;
    const where = project ? { projectId: project.id } : {};
    const [runsCount, last10, coverageAvg] = await Promise.all([
        prisma.testRun.count({ where }),
        prisma.testRun.findMany({ where, orderBy: { startedAt: 'desc' }, take: 10 }),
        prisma.testRun.aggregate({ where, _avg: { coveragePct: true } })
    ]);
    const passRate = last10.length ? last10.reduce((acc, r) => acc + (r.totalCount ? r.passCount / r.totalCount : 0), 0) / last10.length : 0;
    const avgDuration = last10.length ? Math.round(last10.reduce((acc, r) => acc + r.durationMs, 0) / last10.length) : 0;
    res.json({
        totals: { runs: runsCount },
        passRate,
        avgDurationMs: avgDuration,
        coveragePctAvg: coverageAvg._avg.coveragePct ?? null
    });
});
// Multer storage (local)
const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'storage', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
const upload = multer({ dest: path.join(reportsDir, 'tmp') });
router.post('/reports/upload', upload.single('report'), async (req, res) => {
    const runId = req.body?.runId;
    if (!runId)
        return res.status(400).json({ error: 'missing_runId' });
    if (!req.file)
        return res.status(400).json({ error: 'missing_file' });
    const original = req.file.originalname.replace(/[^A-Za-z0-9_.-]/g, '_');
    const finalName = `${runId}_${Date.now()}_${original}`;
    const finalPath = path.join(reportsDir, finalName);
    await fs.promises.mkdir(reportsDir, { recursive: true });
    await fs.promises.rename(req.file.path, finalPath);
    await prisma.testRun.update({ where: { id: runId }, data: { reportFilename: finalName } });
    sseBroadcast('run.updated', { runId, report: `/reports/${finalName}` });
    res.json({ reportUrl: `/reports/${finalName}` });
});
router.get('/runs', async (req, res) => {
    const { projectKey } = req.query;
    const project = projectKey ? await prisma.project.findUnique({ where: { key: projectKey } }) : null;
    const where = project ? { projectId: project.id } : {};
    const runs = await prisma.testRun.findMany({ where, orderBy: { startedAt: 'desc' }, take: 50 });
    res.json(runs);
});
