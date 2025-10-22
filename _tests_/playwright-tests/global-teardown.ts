import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { TestCase, extractTags, getBrowser, ingest, uploadReport, createRun } from '../shared/postRunUtils';

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

async function globalTeardown() {
    console.log('\n========================================');
    console.log('🔄 GLOBAL TEARDOWN STARTED');
    console.log('========================================\n');

    const resultsPath = path.resolve(process.cwd(), 'results.json');
    const reportPath = path.resolve(process.cwd(), 'playwright-report');

    if (!fs.existsSync(resultsPath)) {
        console.log('❌ No results.json found, skipping ingestion');
        return;
    }

    try {
        const { cases, startedAt, finishedAt } = parsePlaywrightJson(resultsPath);

        // Create run object
        const run = createRun('playwright', startedAt, finishedAt);

        // Ingest test cases
        const result = await ingest(run, cases);
        console.log('✅ Ingested run:', result);

        // Upload HTML report if it exists
        if (fs.existsSync(reportPath)) {
            const htmlPath = path.join(reportPath, 'index.html');

            if (fs.existsSync(htmlPath)) {
                const uploaded = await uploadReport(result.runId, htmlPath, 'playwright-report.html');
                console.log('✅ Uploaded HTML report:', uploaded);
            } else {
                // Fallback to ZIP
                const zipPath = path.join(process.cwd(), 'playwright-report.zip');
                const zip = new AdmZip();
                zip.addLocalFolder(reportPath);
                zip.writeZip(zipPath);

                const uploaded = await uploadReport(result.runId, zipPath, 'playwright-report.zip');
                console.log('✅ Uploaded ZIP report:', uploaded);
            }
        }

        console.log('✅ Test results ingestion completed successfully');
    } catch (error) {
        console.error('❌ Error during test result ingestion:', error);
        // Don't throw - we don't want ingestion failures to fail the test run
    }
}

// Export the function as default (Playwright's globalTeardown expects this pattern)
export default globalTeardown;
