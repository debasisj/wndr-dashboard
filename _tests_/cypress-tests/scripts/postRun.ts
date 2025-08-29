import fs from 'fs';
import path from 'path';
import { TestCase, extractTags, getBrowser, ingest, uploadReport, createRun } from '../../shared/postRunUtils';

function parseMochawesome(filePath: string): { cases: TestCase[]; startedAt?: string; finishedAt?: string } {
  if (!fs.existsSync(filePath)) return { cases: [] };
  
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const cases: TestCase[] = [];
  const browser = getBrowser('cypress');
  
  // Extract timing info
  const startedAt = json.stats?.start;
  const finishedAt = json.stats?.end;
  
  // Parse test results
  const results = Array.isArray(json.results) ? json.results : [];
  for (const result of results) {
    const suites = Array.isArray(result.suites) ? result.suites : (result.suite ? [result.suite] : []);
    for (const suite of suites) {
      if (Array.isArray(suite.tests)) {
        for (const test of suite.tests) {
          const title = test.fullTitle || test.title || '';
          const { cleanTitle, tags } = extractTags(title);
          
          let status: 'passed' | 'failed' | 'skipped' = 'failed';
          if (test.state === 'passed') status = 'passed';
          else if (test.state === 'skipped' || test.state === 'pending') status = 'skipped';
          
          cases.push({
            name: cleanTitle,
            status,
            durationMs: Number(test.duration) || 0,
            errorMessage: test.err?.message,
            browser,
            tags
          });
        }
      }
    }
  }
  
  return { cases, startedAt, finishedAt };
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  const jsonPath = path.join(reportsDir, 'mochawesome.json');
  
  const { cases, startedAt, finishedAt } = parseMochawesome(jsonPath);
  const run = createRun('cypress', startedAt, finishedAt);
  
  const result = await ingest(run, cases);
  console.log('Ingested run:', result);
  
  // Upload HTML report
  const htmlPath = path.join(reportsDir, 'index.html');
  if (fs.existsSync(htmlPath)) {
    const uploaded = await uploadReport(result.runId, htmlPath, 'cypress-report.html');
    console.log('Uploaded report:', uploaded);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
