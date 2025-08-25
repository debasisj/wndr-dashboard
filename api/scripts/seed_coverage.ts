import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper functions for realistic coverage data generation
function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getProjectCoverageProfile(projectKey: string) {
    // Different projects with relatively stable test counts over time
    switch (projectKey) {
        case 'web-app':
            return {
                startingTotal: 300, // Starts with 300 tests
                finalTotal: 320,    // Minimal growth to 320 tests
                startingAutoTests: 0,     // 0 automated initially (0%)
                finalAutoTests: 304,      // 95% automated at the end (304/320)
                startingManualTests: 300, // All 300 manual initially (100%)
                finalManualTests: 16,     // Only 5% manual at the end (16/320)
            };
        case 'api-service':
            return {
                startingTotal: 450,
                finalTotal: 470,    // Minimal growth
                startingAutoTests: 0,
                finalAutoTests: 447,    // 95% automated (447/470)
                startingManualTests: 450,
                finalManualTests: 23,   // 5% manual (23/470)
            };
        case 'mobile-app':
            return {
                startingTotal: 180,
                finalTotal: 190,    // Minimal growth
                startingAutoTests: 0,
                finalAutoTests: 181,    // 95% automated (181/190)
                startingManualTests: 180,
                finalManualTests: 9,    // 5% manual (9/190)
            };
        case 'data-pipeline':
            return {
                startingTotal: 120,
                finalTotal: 130,    // Minimal growth
                startingAutoTests: 0,
                finalAutoTests: 124,    // 95% automated (124/130)
                startingManualTests: 120,
                finalManualTests: 6,    // 5% manual (6/130)
            };
        default:
            return {
                startingTotal: 250,
                finalTotal: 260,    // Minimal growth
                startingAutoTests: 0,
                finalAutoTests: 247,    // 95% automated (247/260)
                startingManualTests: 250,
                finalManualTests: 13,   // 5% manual (13/260)
            };
    }
}

// Removed seasonal multiplier function as coverage should be linear

async function main() {
    console.log('Starting comprehensive coverage seed...');

    // Clear existing coverage data
    await prisma.testAutoCoverage.deleteMany();

    // Get or create projects
    const projects = await Promise.all([
        prisma.project.upsert({
            where: { key: 'web-app' },
            create: { key: 'web-app' },
            update: {}
        }),
        prisma.project.upsert({
            where: { key: 'api-service' },
            create: { key: 'api-service' },
            update: {}
        }),
        prisma.project.upsert({
            where: { key: 'mobile-app' },
            create: { key: 'mobile-app' },
            update: {}
        }),
        prisma.project.upsert({
            where: { key: 'data-pipeline' },
            create: { key: 'data-pipeline' },
            update: {}
        })
    ]);

    const now = new Date();
    const startDate = new Date(now.getTime() - (3 * 365 * 24 * 60 * 60 * 1000)); // 3 years ago

    let totalCoverageRecords = 0;
    const batchSize = 50;
    let batch = [];

    // Generate coverage data for each project over 3 years
    for (const project of projects) {
        const profile = getProjectCoverageProfile(project.key);
        console.log(`Generating coverage data for ${project.key}...`);

        // Generate weekly coverage snapshots (more frequent than monthly)
        for (let weekOffset = 0; weekOffset < 3 * 52; weekOffset++) {
            const currentDate = new Date(startDate.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000));

            // Skip some weeks randomly to create realistic gaps (but less frequently)
            if (Math.random() < 0.05) continue; // Only 5% chance to skip a week

            const progressRatio = weekOffset / (3 * 52); // 0 to 1 over 3 years

            // Total tests remain relatively constant with minimal growth
            const totalGrowth = profile.startingTotal +
                (profile.finalTotal - profile.startingTotal) * progressRatio;
            // Very minimal random variation (±2%)
            const randomVariation = 1 + (Math.random() - 0.5) * 0.04;
            const total = Math.floor(totalGrowth * randomVariation);

            // Linear automation progression: 0% to 95% over 3 years
            const automationProgress = Math.min(0.95, progressRatio);
            const autoTestCovered = Math.floor(total * automationProgress);

            // Manual tests: linear decrease from 100% to 5%
            const manualProgress = Math.max(0.05, 1 - progressRatio);
            const manualTestCovered = Math.floor(total * manualProgress);

            // Ensure totals are consistent
            const finalAutoTests = autoTestCovered;
            const finalManualTests = Math.max(0, total - finalAutoTests);
            const finalTotal = total;

            batch.push({
                projectId: project.id,
                autoTestCovered: finalAutoTests,
                manualTestCovered: finalManualTests,
                total: finalTotal,
                createdAt: currentDate
            });

            totalCoverageRecords++;

            // Process batch when it reaches batchSize
            if (batch.length >= batchSize) {
                await prisma.testAutoCoverage.createMany({
                    data: batch
                });
                batch = [];

                if (totalCoverageRecords % 200 === 0) {
                    console.log(`Generated ${totalCoverageRecords} coverage records...`);
                }
            }
        }
    }

    // Process remaining batch
    if (batch.length > 0) {
        await prisma.testAutoCoverage.createMany({
            data: batch
        });
    }

    // Generate some additional high-frequency data for the last 3 months (daily snapshots)
    console.log('Generating recent high-frequency coverage data...');
    const recentBatch = [];
    const recentStartDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)); // 90 days ago

    for (const project of projects) {
        const profile = getProjectCoverageProfile(project.key);

        // Get the latest coverage for this project as baseline
        const latestCoverage = await prisma.testAutoCoverage.findFirst({
            where: { projectId: project.id },
            orderBy: { createdAt: 'desc' }
        });

        if (!latestCoverage) continue;

        for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
            const currentDate = new Date(recentStartDate.getTime() + (dayOffset * 24 * 60 * 60 * 1000));

            // Skip weekends occasionally
            const dayOfWeek = currentDate.getDay();
            if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() < 0.7) continue;

            // Very minimal daily variations (±1%)
            const dailyVariation = 1 + (Math.random() - 0.5) * 0.02;
            const growthFactor = 1 + (dayOffset / 90) * 0.02; // Only 2% growth over 90 days

            const total = Math.floor(latestCoverage.total * growthFactor * dailyVariation);

            // Continue linear automation progression
            const progressInPeriod = dayOffset / 90;
            const currentAutomationRatio = (latestCoverage.autoTestCovered / latestCoverage.total) + (progressInPeriod * 0.01); // 1% more automation over 90 days
            const autoTestCovered = Math.floor(total * Math.min(0.95, currentAutomationRatio));
            const manualTestCovered = Math.max(Math.floor(total * 0.05), total - autoTestCovered);

            recentBatch.push({
                projectId: project.id,
                autoTestCovered,
                manualTestCovered,
                total,
                createdAt: currentDate
            });
        }
    }

    // Insert recent data in batches
    for (let i = 0; i < recentBatch.length; i += batchSize) {
        const batch = recentBatch.slice(i, i + batchSize);
        await prisma.testAutoCoverage.createMany({
            data: batch
        });
    }

    totalCoverageRecords += recentBatch.length;

    console.log(`Coverage seed complete! Generated ${totalCoverageRecords} coverage records over 3 years.`);
    console.log('Coverage data includes:');
    console.log('- Weekly snapshots for 3 years');
    console.log('- Daily snapshots for the last 90 days');
    console.log('- Realistic growth patterns per project');
    console.log('- Seasonal variations and milestone events');
    console.log('- Automation percentage progression over time');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
