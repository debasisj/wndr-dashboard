import fs from 'fs';
import path from 'path';

const apiBase = process.env.DASHBOARD_API || 'http://52.62.135.103:4000';
console.log('end point is',apiBase)
const projectKey = process.env.DASHBOARD_PROJECT || 'web-app';

type Counts = { pass: number; fail: number; skip: number; cases: any[]; startedAt?: string; finishedAt?: string };

type StatsAgg = { passes: number; failures: number; pending: number; skipped: number; start?: string; end?: string };

function listJsonFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...listJsonFilesRecursive(full));
    else if (e.isFile() && e.name.endsWith('.json')) files.push(full);
  }
  return files;
}

function collectFromSuite(suite: any, acc: Counts) {
  if (Array.isArray(suite.tests)) {
    for (const t of suite.tests) {
      const state: string | undefined = t.state || (t.pass ? 'passed' : t.fail ? 'failed' : t.pending ? 'skipped' : undefined);
      let status: 'passed' | 'failed' | 'skipped' = 'failed';
      if (state === 'passed') status = 'passed';
      else if (state === 'skipped' || state === 'pending') status = 'skipped';
      else status = 'failed';
      if (status === 'passed') acc.pass++; else if (status === 'failed') acc.fail++; else acc.skip++;
      acc.cases.push({ name: t.fullTitle || t.title, status, durationMs: Number(t.duration) || 0, errorMessage: t.err?.message });
    }
  }
  if (Array.isArray(suite.suites)) {
    for (const child of suite.suites) collectFromSuite(child, acc);
  }
}

function gatherResults(dir: string): Counts {
  const merged = path.join(dir, 'mochawesome.json');
  const acc: Counts = { pass: 0, fail: 0, skip: 0, cases: [] };
  const statsAgg: StatsAgg = { passes: 0, failures: 0, pending: 0, skipped: 0 };

  const readMochawesome = (filePath: string) => {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (json.stats) {
      statsAgg.passes += Number(json.stats.passes || 0);
      statsAgg.failures += Number(json.stats.failures || 0);
      statsAgg.pending += Number(json.stats.pending || 0);
      statsAgg.skipped += Number(json.stats.skipped || 0);
      // Prefer earliest start and latest end across files
      if (json.stats.start && (!statsAgg.start || new Date(json.stats.start) < new Date(statsAgg.start))) statsAgg.start = json.stats.start;
      if (json.stats.end && (!statsAgg.end || new Date(json.stats.end) > new Date(statsAgg.end))) statsAgg.end = json.stats.end;
    }
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (Array.isArray(r.suites)) {
        for (const s of r.suites) collectFromSuite(s, acc);
      }
      if (r.suite) collectFromSuite(r.suite, acc);
    }
  };

  if (fs.existsSync(merged)) {
    try { readMochawesome(merged); } catch { }
  }

  if (acc.cases.length === 0) {
    const candidates = [dir, path.join(dir, '.jsons')];
    const jsonFiles = Array.from(new Set(candidates.flatMap(listJsonFilesRecursive)));
    for (const f of jsonFiles) {
      try { readMochawesome(f); } catch { }
    }
  }

  if (acc.cases.length === 0) {
    for (let i = 0; i < statsAgg.passes; i++) acc.cases.push({ name: `cypress-pass-${i + 1}`, status: 'passed', durationMs: 0 });
    for (let i = 0; i < statsAgg.failures; i++) acc.cases.push({ name: `cypress-fail-${i + 1}`, status: 'failed', durationMs: 0 });
    const skippedTotal = Math.max(statsAgg.skipped, statsAgg.pending);
    for (let i = 0; i < skippedTotal; i++) acc.cases.push({ name: `cypress-skip-${i + 1}`, status: 'skipped', durationMs: 0 });
    acc.pass = statsAgg.passes;
    acc.fail = statsAgg.failures;
    acc.skip = skippedTotal;
  }

  acc.startedAt = statsAgg.start;
  acc.finishedAt = statsAgg.end;
  return acc;
}

async function ingest(payload: any) {
  const res = await fetch(`${apiBase}/api/v1/results`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`ingest failed: ${res.status}`);
  return res.json();
}

async function uploadReport(runId: string, reportsDir: string) {
  const indexPath = path.join(reportsDir, 'index.html');
  const htmls = fs.existsSync(indexPath) ? [indexPath] : (fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.html')).map(f => path.join(reportsDir, f)) : []);
  if (htmls.length === 0) {
    console.log('No HTML report found to upload');
    return;
  }
  const form = new FormData();
  form.append('runId', runId);
  form.append('report', new Blob([fs.readFileSync(htmls[0])]), 'report.html');
  const res = await fetch(`${apiBase}/api/v1/reports/upload`, { method: 'POST', body: form as any });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return res.json();
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  const { pass, fail, skip, cases, startedAt, finishedAt } = gatherResults(reportsDir);
  // Use current time for test runs to avoid stale timestamps from old report files
  const now = new Date();
  const testStartTime = new Date(now.getTime() - 10000); // 10 seconds ago for start time
  
  const payload = {
    projectKey,
    run: {
      suite: 'cypress',
      env: process.env.TEST_ENV || 'local',
      branch: process.env.CI_BRANCH || 'local',
      startedAt: testStartTime.toISOString(),
      finishedAt: now.toISOString()
    },
    cases
  };
  const result = await ingest(payload);
  console.log('Ingested run:', result, { computed: { pass, fail, skip, total: pass + fail + skip } });
  const uploaded = await uploadReport(result.runId, reportsDir);
  console.log('Uploaded report:', uploaded);
}

main().catch((e) => { console.error(e); process.exit(1); });
