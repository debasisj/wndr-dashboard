/*
  Warnings:

  - You are about to drop the `TestCoverage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `name` on the `Project` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TestCase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TestRun` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TestCoverage";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "TestAutoCoverage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "autoTestCovered" INTEGER NOT NULL,
    "manualTestCovered" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestAutoCoverage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("createdAt", "id", "key") SELECT "createdAt", "id", "key" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");
CREATE TABLE "new_TestCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "browser" TEXT,
    "tagsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TestCase_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TestCase" ("browser", "createdAt", "durationMs", "errorMessage", "id", "name", "runId", "status", "tagsJson") SELECT "browser", "createdAt", "durationMs", "errorMessage", "id", "name", "runId", "status", "tagsJson" FROM "TestCase";
DROP TABLE "TestCase";
ALTER TABLE "new_TestCase" RENAME TO "TestCase";
CREATE TABLE "new_TestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "suite" TEXT NOT NULL,
    "env" TEXT,
    "branch" TEXT,
    "commit" TEXT,
    "ciBuildId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "durationMs" INTEGER NOT NULL,
    "coveragePct" REAL,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "reportFilename" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TestRun" ("branch", "ciBuildId", "commit", "coveragePct", "createdAt", "durationMs", "env", "failCount", "finishedAt", "id", "passCount", "projectId", "reportFilename", "skipCount", "startedAt", "suite", "totalCount") SELECT "branch", "ciBuildId", "commit", "coveragePct", "createdAt", "durationMs", "env", "failCount", "finishedAt", "id", "passCount", "projectId", "reportFilename", "skipCount", "startedAt", "suite", "totalCount" FROM "TestRun";
DROP TABLE "TestRun";
ALTER TABLE "new_TestRun" RENAME TO "TestRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
