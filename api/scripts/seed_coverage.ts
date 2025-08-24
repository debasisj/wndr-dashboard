import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper functions for realistic coverage data generation
function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getProjectCoverageProfile(projectKey: string) {
    // Different projects start with different total test counts and follow realistic automation adoption
    switch (projectKey) {
        case 'web-app':
            return {
                startingTotal: 300, // Starts with 300 tests
                finalTotal: 350,    // Grows to 350 tests
                startingAutoTests: 0,     // 0 automated initially
                finalAutoTests: 345,      // 345 automated at the end
                startingManualTests: 300, // All 300 manual initially
                finalManualTests: 5,      // Only 5 manual at the end
                volatility: 0.08
            };
        case 'api-service':
            return {
                startingTotal: 450,
                finalTotal: 520,
                startingAutoTests: 0,
                finalAutoTests: 500,
                startingManualTests: 450,
                finalManualTests: 20,
                volatility: 0.06
            };
        case 'mobile-app':
            return {
                startingTotal: 180,
                finalTotal: 240,
                startingAutoTests: 0,
                finalAutoTests: 220,
                startingManualTests: 180,
                finalManualTests: 20,
                volatility: 0.12
            };
        case 'data-pipeline':
            return {
                startingTotal: 120,
                finalTotal: 160,
                startingAutoTests: 0,
                finalAutoTests: 155,
                startingManualTests: 120,
                finalManualTests: 5,
                volatility: 0.10
            };
        default:
            return {
                startingTotal: 250,
                finalTotal: 300,
                startingAutoTests: 0,
                finalAutoTests: 280,
                startingManualTests: 250,
                finalManualTests: 20,
                volatility: 0.10
            };
    }
}

function getSeasonalCoverageMultiplier(date: Date): number {
    const month = date.getMonth();
    // Coverage work slows down during holidays and summer
    if (month >= 5 && month <= 7) return 0.85; // Summer slowdown
    if (month === 11) return 0.70; // December holidays
    if (month === 0) return 0.80; // January ramp-up
    if (month === 8 || month === 9) return 1.15; // Back-to-school push
    return 1.0;
}

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

            // Skip some weeks randomly to create realistic gaps
            if (Math.random() < 0.15) continue; // 15% chance to skip a week

            const seasonalMultiplier = getSeasonalCoverageMultiplier(currentDate);
            const progressRatio = weekOffset / (3 * 52); // 0 to 1 over 3 years

            // Calculate total tests growth from starting to final
            const totalGrowth = profile.startingTotal + 
                (profile.finalTotal - profile.startingTotal) * progressRatio;
            const seasonalVariation = seasonalMultiplier;
            const randomVariation = 1 + (Math.random() - 0.5) * profile.volatility;
            
            const total = Math.floor(totalGrowth * seasonalVariation * randomVariation);
            
            // Calculate automation progression: starts at 0, grows to final amount
            // Use a sigmoid curve for realistic automation adoption, but shifted to start near 0
            const automationProgress = progressRatio < 0.1 ? 0 : 
                1 / (1 + Math.exp(-10 * (progressRatio - 0.6))); // S-curve starting later
            const autoTestCovered = Math.floor(
                profile.startingAutoTests + 
                (profile.finalAutoTests - profile.startingAutoTests) * automationProgress
            );
            
            // Manual tests start high and decrease as automation increases
            const manualProgress = 1 - automationProgress; // Inverse of automation
            const manualTestCovered = Math.floor(
                profile.startingManualTests * manualProgress + 
                profile.finalManualTests * (1 - manualProgress)
            );
            
            // Add some milestone events that cause jumps in automation
            let milestoneBoost = 1.0;
            if (weekOffset % 26 === 0 && weekOffset > 0) { // Every 6 months
                milestoneBoost = 1.05 + Math.random() * 0.1; // 5-15% boost in automation
            }
            
            const finalAutoTests = Math.min(total, Math.floor(autoTestCovered * milestoneBoost));
            const finalManualTests = Math.max(0, Math.min(total - finalAutoTests, manualTestCovered));
            const finalTotal = Math.max(finalAutoTests + finalManualTests, total);

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

            // Small daily variations around the baseline
            const dailyVariation = 1 + (Math.random() - 0.5) * 0.05; // ±2.5% variation
            const growthFactor = 1 + (dayOffset / 90) * 0.1; // 10% growth over 90 days

            const total = Math.floor(latestCoverage.total * growthFactor * dailyVariation);
            const autoTestCovered = Math.floor(latestCoverage.autoTestCovered * growthFactor * dailyVariation);
            const manualTestCovered = Math.floor(latestCoverage.manualTestCovered * Math.max(0.8, growthFactor * dailyVariation));

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
