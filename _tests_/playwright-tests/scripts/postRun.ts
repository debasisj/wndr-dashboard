import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { TestCase, extractTags, getBrowser, ingest, uploadReport, createRun } from '../../shared/postRunUtils';

function parsePlaywrightJson(filePath: string): { cases: TestCase[]; startedAt?: string; finishedAt?: string } {
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const cases: TestCase[] = [];
  const browser = getBrowser('playwright');
  
  let minStart: number | undefined;
  let maxEnd: number | undefined;

  for (const suite of json.suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const title = spec.titlePath ? spec.titlePath.join(' › ') : spec.title || test.title;
        const { cleanTitle, tags } = extractTags(title);
        
        const outcome = test.outcome || test.status;
        let status: 'passed' | 'failed' | 'skipped' = 'failed';
        if (outcome === 'expected' || outcome === 'passed') status = 'passed';
        else if (outcome === 'skipped') status = 'skipped';
        
        const results = Array.isArray(test.results) ? test.results : [];
        const durationMs = results[0]?.duration || test.duration || 0;
        const errorMessage = test.errors?.[0]?.message || results.find((r: { error: any; }) => r.error)?.error?.message;
        
        // Track timing for overall run
        if (results[0]?.startTime) {
          const start = new Date(results[0].startTime).getTime();
          const end = start + durationMs;
          minStart = minStart == null ? start : Math.min(minStart, start);
          maxEnd = maxEnd == null ? end : Math.max(maxEnd, end);
        }
        
        cases.push({
          name: cleanTitle,
          status,
          durationMs,
          errorMessage,
          browser,
          tags
        });
      }
    }
  }
  
  const startedAt = minStart ? new Date(minStart).toISOString() : undefined;
  const finishedAt = maxEnd ? new Date(maxEnd).toISOString() : undefined;
  
  return { cases, startedAt, finishedAt };
}

async function uploadPlaywrightReport(runId: string, reportDir: string) {
  const htmlPath = path.join(reportDir, 'index.html');
  
  if (fs.existsSync(htmlPath)) {
    return uploadReport(runId, htmlPath, 'playwright-report.html');
  }
  
  // Fallback to ZIP if no HTML
  console.log('HTML not found, creating ZIP report...');
  const zipPath = path.join(process.cwd(), 'playwright-report.zip');
  const zip = new AdmZip();
  zip.addLocalFolder(reportDir);
  zip.writeZip(zipPath);
  
  return uploadReport(runId, zipPath, 'playwright-report.zip');
}

async function main() {
  const resultsPath = path.join(process.cwd(), 'results.json');
  const reportDir = path.join(process.cwd(), 'playwright-report');
  
  if (!fs.existsSync(resultsPath)) {
    throw new Error('results.json not found; ensure Playwright JSON reporter is configured');
  }
  
  const { cases, startedAt, finishedAt } = parsePlaywrightJson(resultsPath);
  const run = createRun('playwright', startedAt, finishedAt);
  
  const result = await ingest(run, cases);
  console.log('Ingested run:', result);
  
  if (fs.existsSync(reportDir)) {
    const uploaded = await uploadPlaywrightReport(result.runId, reportDir);
    console.log('Uploaded report:', uploaded);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
