import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Server } from 'node:http';

export const router = Router();
const prisma = new PrismaClient();

// SSE clients
const sseClients = new Set<import('express').Response>();

const ADMIN_ENABLED = (process.env.ADMIN_ENABLED || 'false').toLowerCase() === 'true';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function requireAdmin(req: any, res: any): boolean {
  if (!ADMIN_ENABLED) {
    res.status(403).json({ error: 'admin_disabled' });
    return false;
  }
  const token = req.headers['x-admin-token'] || req.query.adminToken;
  if (!token || token !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export function sseInit(server: Server) {
  server.on('close', () => {
    for (const res of sseClients) {
      try { res.end(); } catch { }
    }
    sseClients.clear();
  });
}

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const anyRes = res as any;
  if (typeof anyRes.flushHeaders === 'function') anyRes.flushHeaders();

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function sseBroadcast(event: string, data: unknown) {
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
    if (c.status === 'passed') pass++;
    else if (c.status === 'failed') fail++;
    else skip++;
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
  const { projectKey, since, until } = req.query as { projectKey?: string; since?: string; until?: string };
  const project = projectKey ? await prisma.project.findUnique({ where: { key: projectKey } }) : null;

  let where: any = project ? { projectId: project.id } : {};

  // Add date filtering with validation
  if (since || until) {
    where.startedAt = {};
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.startedAt.gte = sinceDate;
      }
    }
    if (until) {
      const untilDate = new Date(until);
      if (!isNaN(untilDate.getTime())) {
        where.startedAt.lte = untilDate;
      }
    }
  }

  const [runsCount, last10, coverageAvg] = await Promise.all([
    prisma.testRun.count({ where }),
    prisma.testRun.findMany({ where, orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.testRun.aggregate({ where, _avg: { coveragePct: true } })
  ]);

  const passRate = last10.length ? last10.reduce((acc: number, r: { totalCount: number; passCount: number; }) => acc + (r.totalCount ? r.passCount / r.totalCount : 0), 0) / last10.length : 0;
  const avgDuration = last10.length ? Math.round(last10.reduce((acc: any, r: { durationMs: any; }) => acc + r.durationMs, 0) / last10.length) : 0;

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
  const runId = req.body?.runId as string | undefined;
  if (!runId) return res.status(400).json({ error: 'missing_runId' });
  if (!req.file) return res.status(400).json({ error: 'missing_file' });

  const original = req.file.originalname.replace(/[^A-Za-z0-9_.-]/g, '_');
  const finalName = `${runId}_${Date.now()}_${original}`;
  const finalPath = path.join(reportsDir, finalName);
  await fs.promises.mkdir(reportsDir, { recursive: true });
  await fs.promises.rename(req.file.path, finalPath);

  await prisma.testRun.update({ where: { id: runId }, data: { reportFilename: finalName } });

  sseBroadcast('run.updated', { runId, report: `/reports/${finalName}` });
  res.json({ reportUrl: `/reports/${finalName}` });
});

router.get('/coverage/history', async (req, res) => {
  const { projectKey, since, until } = req.query as { projectKey?: string; since?: string; until?: string };
  const project = projectKey ? await prisma.project.findUnique({ where: { key: projectKey } }) : null;

  let where: any = project ? { projectId: project.id } : {};

  // Add date filtering with validation
  if (since || until) {
    where.createdAt = {};
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.createdAt.gte = sinceDate;
      }
    }
    if (until) {
      const untilDate = new Date(until);
      if (!isNaN(untilDate.getTime())) {
        where.createdAt.lte = untilDate;
      }
    }
  }

  const testAutoCoverageVsManual = await prisma.testAutoCoverage.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(testAutoCoverageVsManual);
});

router.get('/runs', async (req, res) => {
  const { projectKey, since, until } = req.query as { projectKey?: string; since?: string; until?: string };
  const project = projectKey ? await prisma.project.findUnique({ where: { key: projectKey } }) : null;

  let where: any = project ? { projectId: project.id } : {};

  // Add date filtering with validation
  if (since || until) {
    where.startedAt = {};
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.startedAt.gte = sinceDate;
      }
    }
    if (until) {
      const untilDate = new Date(until);
      if (!isNaN(untilDate.getTime())) {
        where.startedAt.lte = untilDate;
      }
    }
  }

  const runs = await prisma.testRun.findMany({ where, orderBy: { startedAt: 'desc' }, take: 50 });
  res.json(runs);
});

router.delete('/runs/:id', async (req, res) => {
  const runId = req.params.id;
  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run) return res.status(404).json({ error: 'not_found' });

  // Delete report file if present
  if (run.reportFilename) {
    const filePath = path.join(reportsDir, run.reportFilename);
    try { await fs.promises.unlink(filePath); } catch { }
  }

  // Delete cases then run in a transaction
  await prisma.$transaction([
    prisma.testCase.deleteMany({ where: { runId } }),
    prisma.testRun.delete({ where: { id: runId } })
  ]);

  sseBroadcast('run.deleted', { runId });
  res.json({ ok: true });
});

router.get('/admin/db/schema', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  res.json({ tables });
});

router.post('/admin/db/preview', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { sql } = req.body || {};
  if (!sql || typeof sql !== 'string') return res.status(400).json({ error: 'missing_sql' });
  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    res.json({ rows });
  } catch (e: any) {
    res.status(400).json({ error: 'query_error', message: e?.message || String(e) });
  }
});

router.post('/admin/db/execute', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { sql } = req.body || {};
  if (!sql || typeof sql !== 'string') return res.status(400).json({ error: 'missing_sql' });
  try {
    const result = await prisma.$executeRawUnsafe(sql);
    res.json({ result });
  } catch (e: any) {
    res.status(400).json({ error: 'execute_error', message: e?.message || String(e) });
  }
});

// Get all projects for filter dropdown
router.get('/projects', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        key: true
      },
      orderBy: {
        key: 'asc'
      }
    });
    res.json(projects);
  } catch (e: any) {
    res.status(500).json({ error: 'fetch_projects_error', message: e?.message || String(e) });
  }
});

// Get all suites for filter dropdown (optionally filtered by project)
router.get('/suites', async (req, res) => {
  try {
    const { projectKey } = req.query as { projectKey?: string };

    let where = {};
    if (projectKey) {
      const project = await prisma.project.findUnique({ where: { key: projectKey } });
      if (project) {
        where = { projectId: project.id };
      }
    }

    const suites = await prisma.testRun.findMany({
      where,
      select: {
        suite: true
      },
      distinct: ['suite'],
      orderBy: {
        suite: 'asc'
      }
    });

    res.json(suites);
  } catch (e: any) {
    res.status(500).json({ error: 'fetch_suites_error', message: e?.message || String(e) });
  }
});
