import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper functions for realistic data generation
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCommitHash(): string {
  return Math.random().toString(36).slice(2, 9);
}

function getSeasonalMultiplier(date: Date): number {
  const month = date.getMonth();
  // Lower activity in summer (June-Aug) and holidays (Dec)
  if (month >= 5 && month <= 7) return 0.7; // Summer
  if (month === 11) return 0.6; // December
  if (month === 0) return 0.8; // January
  return 1.0;
}

function getTrendMultiplier(date: Date, startDate: Date): number {
  const monthsElapsed = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  // Gradual improvement in test coverage and stability over time
  return Math.min(1.5, 0.6 + (monthsElapsed * 0.025));
}

async function main() {
  console.log('Starting comprehensive seed...');

  // Clear existing test data but keep projects
  await prisma.testCase.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.testAutoCoverage.deleteMany();

  // Create or get projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { key: 'web-app' },
      update: {},
      create: { key: 'web-app' }
    }),
    prisma.project.upsert({
      where: { key: 'api-service' },
      update: {},
      create: { key: 'api-service' }
    }),
    prisma.project.upsert({
      where: { key: 'mobile-app' },
      update: {},
      create: { key: 'mobile-app' }
    }),
    prisma.project.upsert({
      where: { key: 'data-pipeline' },
      update: {},
      create: { key: 'data-pipeline' }
    })
  ]);

  const suites = ['e2e', 'integration', 'unit', 'smoke', 'performance', 'security'];
  const environments = ['dev', 'staging', 'prod'];
  const branches = ['main', 'develop', 'feature/auth', 'feature/payments', 'hotfix/critical'];

  const now = new Date();
  const startDate = new Date(now.getTime() - (3 * 365 * 24 * 60 * 60 * 1000)); // 3 years ago

  let totalRuns = 0;
  const batchSize = 50;
  let batch = [];

  // Generate test runs over 3 years
  for (let dayOffset = 0; dayOffset < 3 * 365; dayOffset++) {
    const currentDate = new Date(startDate.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
    const seasonalMultiplier = getSeasonalMultiplier(currentDate);
    const trendMultiplier = getTrendMultiplier(currentDate, startDate);

    // Skip weekends occasionally (80% chance to skip)
    const dayOfWeek = currentDate.getDay();
    if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() < 0.8) continue;

    // Generate 1-8 runs per day based on seasonal patterns
    const runsPerDay = Math.floor(randomBetween(1, 8) * seasonalMultiplier);

    for (let runIndex = 0; runIndex < runsPerDay; runIndex++) {
      const project = projects[randomBetween(0, projects.length - 1)];
      const suite = suites[randomBetween(0, suites.length - 1)];
      const env = environments[randomBetween(0, environments.length - 1)];
      const branch = branches[randomBetween(0, branches.length - 1)];

      // Add some time variation throughout the day
      const runTime = new Date(currentDate.getTime() + (runIndex * 2 * 60 * 60 * 1000) + randomBetween(0, 60 * 60 * 1000));

      // Base test counts that vary by suite type
      let baseTests, baseDuration, baseCoverage;
      switch (suite) {
        case 'unit':
          baseTests = randomBetween(50, 200);
          baseDuration = randomBetween(30, 120) * 1000; // 30s-2min
          baseCoverage = randomBetween(75, 95);
          break;
        case 'integration':
          baseTests = randomBetween(20, 80);
          baseDuration = randomBetween(2, 8) * 60 * 1000; // 2-8min
          baseCoverage = randomBetween(60, 85);
          break;
        case 'e2e':
          baseTests = randomBetween(10, 40);
          baseDuration = randomBetween(5, 20) * 60 * 1000; // 5-20min
          baseCoverage = randomBetween(40, 70);
          break;
        case 'smoke':
          baseTests = randomBetween(5, 15);
          baseDuration = randomBetween(1, 3) * 60 * 1000; // 1-3min
          baseCoverage = randomBetween(30, 50);
          break;
        case 'performance':
          baseTests = randomBetween(3, 10);
          baseDuration = randomBetween(10, 30) * 60 * 1000; // 10-30min
          baseCoverage = randomBetween(20, 40);
          break;
        case 'security':
          baseTests = randomBetween(5, 20);
          baseDuration = randomBetween(3, 10) * 60 * 1000; // 3-10min
          baseCoverage = randomBetween(25, 45);
          break;
        default:
          baseTests = randomBetween(10, 50);
          baseDuration = randomBetween(2, 10) * 60 * 1000;
          baseCoverage = randomBetween(50, 80);
      }

      // Apply trend improvements
      const totalTests = Math.floor(baseTests * trendMultiplier);
      const coverage = Math.min(95, baseCoverage * trendMultiplier);

      // Calculate pass/fail rates with improvement over time
      const basePassRate = 0.7 + (trendMultiplier - 0.6) * 0.4; // Improves from 70% to 90%
      const passCount = Math.floor(totalTests * Math.min(0.95, basePassRate + randomBetween(-10, 10) / 100));
      const failCount = Math.floor((totalTests - passCount) * randomBetween(60, 90) / 100);
      const skipCount = totalTests - passCount - failCount;

      const duration = Math.floor(baseDuration * (1 + (totalTests / baseTests - 1) * 0.3)); // Duration scales with test count
      const finishedAt = new Date(runTime.getTime() + duration);

      batch.push({
        projectId: project.id,
        suite,
        env,
        branch,
        commit: generateCommitHash(),
        ciBuildId: `build-${totalRuns + 1}`,
        startedAt: runTime,
        finishedAt,
        durationMs: duration,
        coveragePct: Math.round(coverage * 10) / 10,
        passCount,
        failCount,
        skipCount,
        totalCount: totalTests
      });

      totalRuns++;

      // Process batch when it reaches batchSize
      if (batch.length >= batchSize) {
        await processBatch(batch);
        batch = [];
        if (totalRuns % 500 === 0) {
          console.log(`Generated ${totalRuns} test runs...`);
        }
      }
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    await processBatch(batch);
  }

  // Generate test coverage history data
  console.log('Generating coverage history...');
  let coverageBatch = [];

  for (let monthOffset = 0; monthOffset < 36; monthOffset++) { // 3 years of monthly data
    const coverageDate = new Date(startDate.getTime() + (monthOffset * 30 * 24 * 60 * 60 * 1000));

    for (const project of projects) {
      const trendMultiplier = getTrendMultiplier(coverageDate, startDate);

      // Base coverage numbers that grow over time
      const baseTotal = randomBetween(100, 500);
      const total = Math.floor(baseTotal * trendMultiplier);
      const autoTestCovered = Math.floor(total * (0.3 + trendMultiplier * 0.4)); // Grows from 30% to 70%
      const manualTestCovered = Math.floor(total * (0.4 - trendMultiplier * 0.1)); // Shrinks from 40% to 30%

      coverageBatch.push({
        projectId: project.id,
        autoTestCovered,
        manualTestCovered,
        total,
        createdAt: coverageDate
      });
    }
  }

  // Insert coverage data in batches
  for (let i = 0; i < coverageBatch.length; i += 20) {
    const batch = coverageBatch.slice(i, i + 20);
    await prisma.testAutoCoverage.createMany({
      data: batch
    });
  }

  console.log(`Seed complete! Generated ${totalRuns} test runs and ${coverageBatch.length} coverage records over 3 years.`);
}

async function processBatch(batch: any[]) {
  const testCaseTemplates = [
    'user authentication',
    'data validation',
    'api response time',
    'database connection',
    'file upload',
    'payment processing',
    'email notification',
    'search functionality',
    'user permissions',
    'data export',
    'cache invalidation',
    'error handling',
    'session management',
    'form submission',
    'image processing'
  ];

  for (const runData of batch) {
    const numCases = Math.min(randomBetween(3, 8), runData.totalCount);
    const cases = [];

    for (let i = 0; i < numCases; i++) {
      const template = testCaseTemplates[randomBetween(0, testCaseTemplates.length - 1)];
      const caseName = `${template} ${i + 1}`;

      let status: 'passed' | 'failed' | 'skipped';
      if (i < runData.passCount) status = 'passed';
      else if (i < runData.passCount + runData.failCount) status = 'failed';
      else status = 'skipped';

      cases.push({
        name: caseName,
        status,
        durationMs: randomBetween(100, 5000),
        errorMessage: status === 'failed' ? `${template} failed: ${['timeout', 'validation error', 'network error', 'assertion failed'][randomBetween(0, 3)]}` : undefined
      });
    }

    await prisma.testRun.create({
      data: {
        ...runData,
        cases: {
          create: cases
        }
      }
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
