import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const apiBase = process.env.DASHBOARD_API || 'http://localhost:4000';
const projectKey = process.env.DASHBOARD_PROJECT || 'web-app';

function readPlaywrightJson(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

type Times = { startedAt?: string; finishedAt?: string };

function toDashboardPayload(pw: any) {
  const { times, cases, pass, fail, skip } = extractCasesAndTimes(pw);
  const startedAt = times.startedAt || pw.startTime || new Date().toISOString();
  const finishedAt = times.finishedAt || pw.endTime || new Date().toISOString();

  return {
    pass, fail, skip,
    payload: {
      projectKey,
      run: {
        suite: 'playwright',
        env: process.env.TEST_ENV || 'local',
        branch: process.env.CI_BRANCH || 'local',
        commit: process.env.CI_COMMIT || undefined,
        ciBuildId: process.env.CI_BUILD_ID || undefined,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString()
      },
      cases
    }
  };
}

function extractCasesAndTimes(pw: any): { pass: number; fail: number; skip: number; cases: any[]; times: Times } {
  const cases: any[] = [];
  let pass = 0, fail = 0, skip = 0;
  let minStart: number | undefined;
  let maxEnd: number | undefined;

  const considerResult = (res: any) => {
    const startIso = res?.startTime || res?.startTimeUTC || undefined;
    const durationMs: number = typeof res?.duration === 'number' ? res.duration : 0;
    if (startIso && durationMs >= 0) {
      const start = new Date(startIso).getTime();
      const end = start + durationMs;
      if (!isNaN(start)) {
        minStart = minStart == null ? start : Math.min(minStart, start);
        maxEnd = maxEnd == null ? end : Math.max(maxEnd, end);
      }
    }
  };

  for (const suite of pw.suites || []) {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const title = spec.titlePath ? spec.titlePath.join(' › ') : spec.title || t.title;
        const outcome = t.outcome || t.status;
        const resultArr = Array.isArray(t.results) ? t.results : [];
        for (const r of resultArr) considerResult(r);
        const durationMs = resultArr.length ? (resultArr[0].duration || 0) : (typeof t.duration === 'number' ? t.duration : 0);
        let status: 'passed' | 'failed' | 'skipped';
        if (outcome === 'expected' || outcome === 'passed') status = 'passed';
        else if (outcome === 'skipped') status = 'skipped';
        else status = 'failed';
        if (status === 'passed') pass++; else if (status === 'failed') fail++; else skip++;
        const errorMessage = t.errors?.[0]?.message || resultArr.find((r: any) => r.error)?.error?.message;
        cases.push({ name: title, status, durationMs, errorMessage });
      }
    }
  }

  const times: Times = {};
  if (minStart != null) times.startedAt = new Date(minStart).toISOString();
  if (maxEnd != null) times.finishedAt = new Date(maxEnd).toISOString();

  return { pass, fail, skip, cases, times };
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

async function uploadReport(runId: string, reportDir: string) {
  const htmlIndex = path.join(reportDir, 'index.html');
  if (fs.existsSync(htmlIndex)) {
    const form = new FormData();
    form.append('runId', runId);
    form.append('report', new Blob([fs.readFileSync(htmlIndex)]), 'report.html');
    const res = await fetch(`${apiBase}/api/v1/reports/upload`, { method: 'POST', body: form as any });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return res.json();
  }
  const zipPath = path.join(process.cwd(), 'playwright-report.zip');
  const zip = new AdmZip();
  zip.addLocalFolder(reportDir);
  zip.writeZip(zipPath);
  const form = new FormData();
  form.append('runId', runId);
  form.append('report', new Blob([fs.readFileSync(zipPath)]), 'report.zip');
  const res = await fetch(`${apiBase}/api/v1/reports/upload`, { method: 'POST', body: form as any });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return res.json();
}

async function main() {
  const resultsPath = path.join(process.cwd(), 'results.json');
  const reportDir = path.join(process.cwd(), 'playwright-report');
  if (!fs.existsSync(resultsPath)) {
    throw new Error('results.json not found; ensure Playwright JSON reporter is configured');
  }
  const pw = readPlaywrightJson(resultsPath);
  const { payload } = toDashboardPayload(pw);
  const result = await ingest(payload);
  console.log('Ingested run:', result);

  if (fs.existsSync(reportDir)) {
    const uploaded = await uploadReport(result.runId, reportDir);
    console.log('Uploaded report:', uploaded);
  } else {
    console.log('Report directory not found, skipping upload');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
