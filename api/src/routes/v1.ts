import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Server } from 'node:http';
import { S3Service } from '../services/s3.js';
import { NaturalLanguageParser } from '../services/nlQueryParser.js';
import { AnalyticsQueryBuilder } from '../services/analyticsQueryBuilder.js';

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

// Storage configuration
const STORAGE_TYPE = process.env.REPORTS_STORAGE || 'local'; // 'local' or 's3'
const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'storage', 'reports');

// Debug logging
console.log('STORAGE_TYPE:', STORAGE_TYPE);
console.log('REPORTS_STORAGE env var:', process.env.REPORTS_STORAGE);

// Ensure local directory exists if using local storage
if (STORAGE_TYPE === 'local') {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const upload = multer({ dest: path.join(process.cwd(), 'tmp') });

router.post('/reports/upload', upload.single('report'), async (req, res) => {
  const runId = req.body?.runId as string | undefined;
  if (!runId) return res.status(400).json({ error: 'missing_runId' });
  if (!req.file) return res.status(400).json({ error: 'missing_file' });

  try {
    const original = req.file.originalname.replace(/[^A-Za-z0-9_.-]/g, '_');
    const finalName = `${runId}_${Date.now()}_${original}`;
    let reportUrl: string;

    if (STORAGE_TYPE === 's3') {
      // Upload to S3
      const s3Key = `reports/${finalName}`;
      const contentType = req.file.mimetype || 'application/octet-stream';
      await S3Service.uploadFile(s3Key, req.file.path, contentType);
      reportUrl = `/api/v1/reports/${finalName}`; // We'll serve via signed URLs

      // Clean up temp file
      await fs.promises.unlink(req.file.path);
    } else {
      // Local storage
      const finalPath = path.join(reportsDir, finalName);
      await fs.promises.mkdir(reportsDir, { recursive: true });
      // Use copyFile + unlink instead of rename to handle cross-device moves
      await fs.promises.copyFile(req.file.path, finalPath);
      await fs.promises.unlink(req.file.path);
      reportUrl = `/reports/${finalName}`;
    }

    await prisma.testRun.update({ where: { id: runId }, data: { reportFilename: finalName, reportUrl } });

    sseBroadcast('run.updated', { runId, report: reportUrl });
    res.json({ reportUrl });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up temp file on error
    if (req.file?.path) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch { }
    }
    res.status(500).json({ error: 'upload_failed' });
  }
});

// Serve reports (S3 signed URLs or local files)
router.get('/reports/:filename', async (req, res) => {
  const { filename } = req.params;

  if (STORAGE_TYPE === 's3') {
    try {
      const s3Key = `reports/${filename}`;
      const signedUrl = await S3Service.getSignedUrl(s3Key, 3600); // 1 hour expiry
      res.redirect(signedUrl);
    } catch (error) {
      console.error('S3 error:', error);
      res.status(404).json({ error: 'file_not_found' });
    }
  } else {
    // Local file serving (handled by express.static in index.ts)
    res.status(404).json({ error: 'use_static_route' });
  }
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

  const testAutoCoverageVsManual = await prisma.testAutoCoverage.findMany({ where, orderBy: { createdAt: 'asc' }, take: 100 });
  res.json(testAutoCoverageVsManual);
});

router.get('/runs', async (req, res) => {
  const { projectKey, since, until, page, limit } = req.query as {
    projectKey?: string;
    since?: string;
    until?: string;
    page?: string;
    limit?: string;
  };
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

  // Pagination parameters
  const pageNum = parseInt(page || '1', 10);
  const pageSize = parseInt(limit || '50', 10);
  const skip = (pageNum - 1) * pageSize;

  // Get total count for pagination info
  const totalCount = await prisma.testRun.count({ where });
  const totalPages = Math.ceil(totalCount / pageSize);

  const runs = await prisma.testRun.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: pageSize,
    skip: skip,
    include: {
      project: {
        select: {
          key: true
        }
      }
    }
  });

  res.json({
    runs,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalCount,
      pageSize,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    }
  });
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
    // Convert BigInt to regular numbers for JSON serialization
    const serializedRows = JSON.parse(JSON.stringify(rows, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));
    res.json({ rows: serializedRows });
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

// Natural Language Analytics Query
router.post('/analytics/query', async (req, res) => {
  try {
    const { query } = req.body as { query?: string };

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'missing_query' });
    }

    // Parse natural language query
    const parser = new NaturalLanguageParser();
    const params = parser.parse(query);

    // Build SQL query
    const queryBuilder = new AnalyticsQueryBuilder();
    const sql = queryBuilder.build(params);

    // Execute query
    const results = await prisma.$queryRawUnsafe(sql);

    // Convert BigInt to regular numbers for JSON serialization
    const serializedResults = JSON.parse(JSON.stringify(results, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));

    // Get human-readable description
    const description = parser.getDescription(params);

    res.json({
      query: query,
      description: description,
      params: params,
      results: serializedResults,
      count: Array.isArray(serializedResults) ? serializedResults.length : 0
    });

  } catch (e: any) {
    console.error('Analytics query error:', e);
    res.status(500).json({
      error: 'analytics_query_error',
      message: e?.message || String(e)
    });
  }
});

// Get failure details for a specific test
router.get('/analytics/test/:testName/failures', async (req, res) => {
  try {
    const { testName } = req.params;
    const { projectKey, days = '90' } = req.query as { projectKey?: string; days?: string };

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    let projectFilter = '';
    if (projectKey) {
      const project = await prisma.project.findUnique({ where: { key: projectKey } });
      if (project) {
        projectFilter = `AND p.key = '${projectKey.replace(/'/g, "''")}'`;
      }
    }

    const sql = `
      SELECT 
        tr.id as runId,
        tr.startedAt,
        tr.env,
        tr.branch,
        tr."commit" as commitHash,
        tc.errorMessage,
        tc.browser,
        tc.durationMs,
        p.key as project
      FROM TestCase tc
      JOIN TestRun tr ON tc.runId = tr.id
      JOIN Project p ON tr.projectId = p.id
      WHERE tc.name = '${testName.replace(/'/g, "''")}'
        AND tc.status = 'failed'
        AND date(datetime(tr.startedAt/1000, 'unixepoch')) > '${cutoffDateString}'
        ${projectFilter}
      ORDER BY tr.startedAt DESC
      LIMIT 100
    `;

    const failures = await prisma.$queryRawUnsafe(sql);

    // Convert BigInt to regular numbers for JSON serialization
    const serializedFailures = JSON.parse(JSON.stringify(failures, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));

    res.json({
      testName,
      failures: serializedFailures,
      count: Array.isArray(serializedFailures) ? serializedFailures.length : 0
    });

  } catch (e: any) {
    console.error('Test failures query error:', e);
    res.status(500).json({
      error: 'test_failures_error',
      message: e?.message || String(e)
    });
  }
});

// Get query suggestions
router.get('/analytics/suggestions', (req, res) => {
  const suggestions = [
    {
      text: "Show me flaky tests with pass rate less than 80%",
      category: "Flaky Tests",
      icon: "🔄"
    },
    {
      text: "Find tests failing more than 3 times in last 7 days",
      category: "Failing Tests",
      icon: "❌"
    },
    {
      text: "Show slowest tests taking more than 30 seconds",
      category: "Performance",
      icon: "🐌"
    },
    {
      text: "Brittle tests in staging environment last 3 months",
      category: "Environment Issues",
      icon: "🏗️"
    },
    {
      text: "Tests that started failing in last week",
      category: "Recent Issues",
      icon: "🚨"
    },
    {
      text: "Top 10 most unreliable tests",
      category: "Top Issues",
      icon: "📊"
    },
    {
      text: "Slow tests in chrome browser last month",
      category: "Browser Issues",
      icon: "🌐"
    },
    {
      text: "Flaky tests with pass rate between 20% and 80%",
      category: "Flaky Tests",
      icon: "🔄"
    }
  ];

  res.json({ suggestions });
});

// Debug endpoint to check test case data
router.get('/analytics/debug', async (req, res) => {
  try {
    const { days = '7' } = req.query as { days?: string };

    // Check recent test cases
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    const recentCases = await prisma.$queryRawUnsafe(`
      SELECT 
        tc.name,
        tc.status,
        tr.startedAt,
        p.key as project,
        CAST(COUNT(*) OVER (PARTITION BY tc.name) as INTEGER) as total_runs,
        CAST(SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) OVER (PARTITION BY tc.name) as INTEGER) as total_failures
      FROM TestCase tc
      JOIN TestRun tr ON tc.runId = tr.id
      JOIN Project p ON tr.projectId = p.id
      WHERE date(datetime(tr.startedAt/1000, 'unixepoch')) > '${cutoffDateString}'
      ORDER BY tr.startedAt DESC
      LIMIT 20
    `);

    // Check failing test summary
    const failingSummary = await prisma.$queryRawUnsafe(`
      SELECT 
        tc.name,
        CAST(COUNT(*) as INTEGER) as total_runs,
        CAST(SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as INTEGER) as failures,
        p.key as project
      FROM TestCase tc
      JOIN TestRun tr ON tc.runId = tr.id
      JOIN Project p ON tr.projectId = p.id
      WHERE date(datetime(tr.startedAt/1000, 'unixepoch')) > '${cutoffDateString}'
      GROUP BY tc.name, p.key
      HAVING failures > 0
      ORDER BY failures DESC
      LIMIT 10
    `);

    // Convert BigInt to regular numbers for JSON serialization
    const serializedRecentCases = JSON.parse(JSON.stringify(recentCases, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));
    const serializedFailingSummary = JSON.parse(JSON.stringify(failingSummary, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));

    res.json({
      days: parseInt(days),
      recentCases: serializedRecentCases,
      failingSummary: serializedFailingSummary,
      recentCasesCount: Array.isArray(serializedRecentCases) ? serializedRecentCases.length : 0,
      failingSummaryCount: Array.isArray(serializedFailingSummary) ? serializedFailingSummary.length : 0
    });

  } catch (e: any) {
    console.error('Debug query error:', e);
    res.status(500).json({
      error: 'debug_query_error',
      message: e?.message || String(e)
    });
  }
});
