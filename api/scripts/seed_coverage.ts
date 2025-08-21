import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Get or create a project
    const project = await prisma.project.upsert({
        where: { key: 'web-app' },
        create: { key: 'web-app' },
        update: {}
    });

    // Create sample coverage data over time (last 30 days)
    const now = new Date();
    const sampleData = [
        { daysAgo: 30, autoTestCovered: 45, manualTestCovered: 35, total: 100 },
        { daysAgo: 25, autoTestCovered: 50, manualTestCovered: 35, total: 105 },
        { daysAgo: 20, autoTestCovered: 55, manualTestCovered: 40, total: 110 },
        { daysAgo: 15, autoTestCovered: 62, manualTestCovered: 38, total: 115 },
        { daysAgo: 10, autoTestCovered: 68, manualTestCovered: 37, total: 120 },
        { daysAgo: 5, autoTestCovered: 75, manualTestCovered: 35, total: 125 },
        { daysAgo: 0, autoTestCovered: 80, manualTestCovered: 35, total: 130 },
    ];

    for (const data of sampleData) {
        const createdAt = new Date(now.getTime() - data.daysAgo * 24 * 60 * 60 * 1000);

        await prisma.testAutoCoverage.create({
            data: {
                projectId: project.id,
                autoTestCovered: data.autoTestCovered,
                manualTestCovered: data.manualTestCovered,
                total: data.total,
                createdAt
            }
        });
    }

    console.log('Sample coverage data created successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
