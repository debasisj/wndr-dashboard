import fs from 'fs';
import path from 'path';

const apiBase = process.env.DASHBOARD_API || 'http://localhost:4000';
const projectKey = process.env.DASHBOARD_PROJECT || 'web-app';

export interface TestCase {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  errorMessage?: string;
  browser?: string;
  tags?: string[];
}

export interface TestRun {
  suite: string;
  env: string;
  branch: string;
  commit?: string;
  ciBuildId?: string;
  startedAt: string;
  finishedAt: string;
}

export function extractTags(title: string): { cleanTitle: string; tags?: string[] } {
  const tagMatches = title.match(/@(\w+)/g);
  const tags = tagMatches ? tagMatches.map(tag => tag.substring(1)) : undefined;
  const cleanTitle = title.replace(/@\w+/g, '').trim();
  return { cleanTitle: cleanTitle || title, tags };
}

export function getBrowser(suite: string): string {
  const envVars = {
    cypress: process.env.CYPRESS_BROWSER,
    selenium: process.env.SELENIUM_BROWSER || process.env.BROWSER,
    playwright: process.env.PLAYWRIGHT_BROWSER
  };
  return envVars[suite as keyof typeof envVars] || 'chrome';
}

export async function ingest(run: TestRun, cases: TestCase[]) {
  const payload = { projectKey, run, cases };
  const res = await fetch(`${apiBase}/api/v1/results`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`ingest failed: ${res.status}`);
  return res.json();
}

export async function uploadReport(runId: string, reportPath: string, filename: string) {
  if (!fs.existsSync(reportPath)) {
    console.log('No report found to upload');
    return;
  }
  
  const form = new FormData();
  form.append('runId', runId);
  form.append('report', new Blob([fs.readFileSync(reportPath)]), filename);
  
  const res = await fetch(`${apiBase}/api/v1/reports/upload`, { 
    method: 'POST', 
    body: form as any 
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return res.json();
}

export function createRun(suite: string, startedAt?: string, finishedAt?: string): TestRun {
  const now = new Date().toISOString();
  return {
    suite,
    env: process.env.TEST_ENV || 'local',
    branch: process.env.CI_BRANCH || 'local',
    commit: process.env.CI_COMMIT,
    ciBuildId: process.env.CI_BUILD_ID,
    startedAt: startedAt || now,
    finishedAt: finishedAt || now
  };
}