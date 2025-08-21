import fs from 'node:fs';
import path from 'node:path';

const apiBase = process.env.DASHBOARD_API || 'http://localhost:4000';
const projectKey = process.env.DASHBOARD_PROJECT || 'web-app';

type Counts = { pass: number; fail: number; skip: number; cases: any[]; startedAt?: string; finishedAt?: string };

function gatherFromMochawesome(filePath: string): Counts {
  const acc: Counts = { pass: 0, fail: 0, skip: 0, cases: [] };
  if (!fs.existsSync(filePath)) return acc;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (json.stats) {
    acc.pass = Number(json.stats.passes || 0);
    acc.fail = Number(json.stats.failures || 0);
    acc.skip = Number(json.stats.pending || 0) + Number(json.stats.skipped || 0);
    if (json.stats.start) acc.startedAt = json.stats.start;
    if (json.stats.end) acc.finishedAt = json.stats.end;
  }
  if (Array.isArray(json.results)) {
    for (const r of json.results) {
      const suites = Array.isArray(r.suites) ? r.suites : (r.suite ? [r.suite] : []);
      for (const s of suites) {
        if (Array.isArray(s.tests)) {
          for (const t of s.tests) {
            const state: 'passed' | 'failed' | 'skipped' = t.state === 'passed' ? 'passed' : t.state === 'pending' ? 'skipped' : 'failed';
            acc.cases.push({ name: t.fullTitle || t.title, status: state, durationMs: Number(t.duration) || 0, errorMessage: t.err?.message });
          }
        }
      }
    }
  }
  if (acc.cases.length === 0 && (acc.pass + acc.fail + acc.skip) > 0) {
    for (let i = 0; i < acc.pass; i++) acc.cases.push({ name: `selenium-pass-${i + 1}`, status: 'passed', durationMs: 0 });
    for (let i = 0; i < acc.fail; i++) acc.cases.push({ name: `selenium-fail-${i + 1}`, status: 'failed', durationMs: 0 });
    for (let i = 0; i < acc.skip; i++) acc.cases.push({ name: `selenium-skip-${i + 1}`, status: 'skipped', durationMs: 0 });
  }
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
  const htmlCandidates = [path.join(reportsDir, 'mochawesome.html'), path.join(reportsDir, 'index.html')];
  const candidate = htmlCandidates.find(p => fs.existsSync(p));
  if (!candidate) return;
  const form = new FormData();
  form.append('runId', runId);
  form.append('report', new Blob([fs.readFileSync(candidate)]), 'selenium-report.html');
  const res = await fetch(`${apiBase}/api/v1/reports/upload`, { method: 'POST', body: form as any });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return res.json();
}

async function main() {
  const candidates = [
    path.join(process.cwd(), 'mochawesome-report'),
    path.join(process.cwd(), 'reports'),
  ];
  const reportDir = candidates.find(d => fs.existsSync(d)) || candidates[0];
  const merged = path.join(reportDir, 'mochawesome.json');
  const { pass, fail, skip, cases, startedAt, finishedAt } = gatherFromMochawesome(merged);
  const payload = {
    projectKey,
    run: {
      suite: 'selenium',
      env: process.env.TEST_ENV || 'local',
      branch: process.env.CI_BRANCH || 'local',
      startedAt: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
      finishedAt: finishedAt ? new Date(finishedAt).toISOString() : new Date().toISOString()
    },
    cases
  };
  const result = await ingest(payload);
  console.log('Ingested run:', result, { computed: { pass, fail, skip, total: pass + fail + skip } });
  const uploaded = await uploadReport(result.runId, reportDir);
  console.log('Uploaded report:', uploaded);
}

main().catch((e) => {
  console.error(e);
  // Use a fallback for process.exit if process is not defined (e.g., in browser-like environments)
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  } else {
    // Optionally throw to indicate failure in environments without process.exit
    throw e;
  }
});
