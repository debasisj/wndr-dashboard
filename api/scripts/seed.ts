import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.upsert({
    where: { key: 'web-app' },
    update: {},
    create: { key: 'web-app', name: 'Web App' }
  });
  const project2 = await prisma.project.upsert({
    where: { key: 'api-service' },
    update: {},
    create: { key: 'api-service', name: 'API Service' }
  });

  const now = new Date();
  const runsData = [
    { projectId: project.id, suite: 'e2e', env: 'staging', pass: 12, fail: 3, skip: 1, duration: 5 * 60 * 1000, cov: 78.5 },
    { projectId: project.id, suite: 'smoke', env: 'staging', pass: 8, fail: 0, skip: 0, duration: 2 * 60 * 1000, cov: 80.2 },
    { projectId: project2.id, suite: 'integration', env: 'dev', pass: 30, fail: 2, skip: 3, duration: 12 * 60 * 1000, cov: 65.0 }
  ];

  for (let i = 0; i < runsData.length; i++) {
    const r = runsData[i];
    const startedAt = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
    const finishedAt = new Date(startedAt.getTime() + r.duration);
    await prisma.testRun.create({
      data: {
        projectId: r.projectId,
        suite: r.suite,
        env: r.env,
        branch: 'main',
        commit: Math.random().toString(36).slice(2, 9),
        ciBuildId: `build-${100 + i}`,
        startedAt,
        finishedAt,
        durationMs: r.duration,
        coveragePct: r.cov,
        passCount: r.pass,
        failCount: r.fail,
        skipCount: r.skip,
        totalCount: r.pass + r.fail + r.skip,
        cases: {
          create: [
            { name: 'login works', status: 'passed', durationMs: 2100 },
            { name: 'signup works', status: 'passed', durationMs: 3200 },
            { name: 'checkout validation', status: r.fail > 0 ? 'failed' : 'passed', durationMs: 4200, errorMessage: r.fail > 0 ? 'ValidationError' : undefined }
          ]
        }
      }
    });
  }

  console.log('Seed complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
