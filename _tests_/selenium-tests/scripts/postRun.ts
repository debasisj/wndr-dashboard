import fs from 'fs';
import path from 'path';
import { TestCase, extractTags, getBrowser, ingest, uploadReport, createRun } from '../../shared/postRunUtils';

function parseMochawesome(filePath: string): { cases: TestCase[]; startedAt?: string; finishedAt?: string } {
  if (!fs.existsSync(filePath)) return { cases: [] };
  
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const cases: TestCase[] = [];
  const browser = getBrowser('selenium');
  
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
          else if (test.state === 'pending') status = 'skipped';
          
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
  const reportDirs = [
    path.join(process.cwd(), 'mochawesome-report'),
    path.join(process.cwd(), 'reports')
  ];
  const reportDir = reportDirs.find(d => fs.existsSync(d)) || reportDirs[0];
  const jsonPath = path.join(reportDir, 'mochawesome.json');
  
  const { cases, startedAt, finishedAt } = parseMochawesome(jsonPath);
  const run = createRun('selenium', startedAt, finishedAt);
  
  const result = await ingest(run, cases);
  console.log('Ingested run:', result);
  
  // Upload HTML report
  const htmlCandidates = [
    path.join(reportDir, 'mochawesome.html'),
    path.join(reportDir, 'index.html')
  ];
  const htmlPath = htmlCandidates.find(p => fs.existsSync(p));
  if (htmlPath) {
    const uploaded = await uploadReport(result.runId, htmlPath, 'selenium-report.html');
    console.log('Uploaded report:', uploaded);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
