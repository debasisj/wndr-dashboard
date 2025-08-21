import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'storage', 'reports');
  await fs.promises.mkdir(reportsDir, { recursive: true });

  const now = Date.now();
  const filename = `demo-report-${now}.html`;
  const filepath = path.join(reportsDir, filename);
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Demo Test Report</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; }
    .status-pass { color: #0b8a3b; }
    .status-fail { color: #ba1a1a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #eee; text-align: left; padding: 8px; }
  </style>
</head>
<body>
  <h1>WNDR Demo Report</h1>
  <p>Generated: ${new Date(now).toLocaleString()}</p>
  <table>
    <thead>
      <tr><th>Test</th><th>Status</th><th>Duration</th></tr>
    </thead>
    <tbody>
      <tr><td>login works</td><td class="status-pass">passed</td><td>2.1s</td></tr>
      <tr><td>signup works</td><td class="status-pass">passed</td><td>3.2s</td></tr>
      <tr><td>checkout validation</td><td class="status-fail">failed</td><td>4.2s</td></tr>
    </tbody>
  </table>
</body>
</html>`;
  await fs.promises.writeFile(filepath, html, 'utf8');

  const latestRun = await prisma.testRun.findFirst({ orderBy: { startedAt: 'desc' } });
  if (!latestRun) {
    console.log('No runs found to attach report.');
    return;
  }
  await prisma.testRun.update({ where: { id: latestRun.id }, data: { reportFilename: filename } });

  const url = `/reports/${filename}`;
  console.log(`Attached report to run ${latestRun.id}: ${url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
