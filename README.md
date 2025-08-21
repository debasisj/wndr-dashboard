# WNDR QA Automation Dashboard

All-in-one dashboard for QA automation KPIs, execution tracking, and report management.

## Stack
- API: Node.js, Express, TypeScript, Prisma
- DB: SQLite (dev & Docker)
- UI: Next.js (React + TypeScript) with Recharts
- Realtime: Server-Sent Events (SSE)
- Storage: Local filesystem for HTML reports (S3-ready)
- Docker: Multi-service via docker-compose

## Quick Start (Local Dev)

1. Install dependencies
```bash
cd api && npm install && cd ../web && npm install && cd ..
```

2. Setup DB and Prisma (dev uses SQLite)
```bash
cd api
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```

3. Run the web UI
```bash
cd ../web
cp .env.example .env.local
npm run dev
```

- API runs on `http://localhost:4000`
- Web runs on `http://localhost:3000`

## Docker (All-in-one)
```bash
docker compose up -d --build
```
- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## REST API (Ingestion)
POST `/api/v1/results`
```json
{
  "projectKey": "web-app",
  "run": {
    "suite": "e2e",
    "env": "staging",
    "branch": "main",
    "commit": "abc123",
    "ciBuildId": "build-42",
    "startedAt": "2025-01-01T10:00:00Z",
    "finishedAt": "2025-01-01T10:05:00Z",
    "coveragePct": 78.5
  },
  "cases": [
    { "name": "login works", "status": "passed", "durationMs": 2100, "browser": "chromium", "tags": ["smoke"] },
    { "name": "checkout fails without card", "status": "failed", "durationMs": 3500, "errorMessage": "ValidationError" }
  ]
}
```

Response contains created `runId` and computed aggregates.

## HTML Report Upload
POST `/api/v1/reports/upload` (multipart/form-data)
- **fields**: `runId` (required)
- **file**: `report` (HTML or ZIP)

Uploaded reports are saved to `api/storage/reports/` and accessible at `/reports/<filename>`.

## Realtime KPIs
- SSE stream: `GET /api/v1/events`
- Message types: `run.created`, `run.updated`

## Configure S3 (optional)
Set in `api/.env`:
```
REPORTS_STORAGE=s3
S3_BUCKET=your-bucket
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## Project Structure
```
api/                    # Express API + Prisma
web/                    # Next.js UI
_tests_/                # All test frameworks
├── playwright-tests/   # Playwright E2E tests
├── cypress-tests/      # Cypress E2E tests
└── selenium-tests/     # Selenium WebDriver tests
storage/                # (created at runtime) report files
```

## License
MIT

## CI integration (GitHub Actions)

### Playwright (JSON + HTML → ingest + upload)
```yaml
name: e2e-playwright
on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: _tests_/playwright-tests/package-lock.json
      - name: Install deps and browsers
        run: |
          cd _tests_/playwright-tests
          npm ci
          npx playwright install --with-deps chromium
      - name: Run Playwright (allow failures)
        run: |
          cd _tests_/playwright-tests
          DASHBOARD_API=${{ vars.DASHBOARD_API || 'http://localhost:4000' }} \
          DASHBOARD_PROJECT=${{ vars.DASHBOARD_PROJECT || 'web-app' }} \
          CI_BRANCH=${{ github.ref_name }} CI_COMMIT=${{ github.sha }} \
          npx playwright test || true
      - name: Ingest results and upload report
        run: |
          cd _tests_/playwright-tests
          DASHBOARD_API=${{ vars.DASHBOARD_API || 'http://localhost:4000' }} \
          DASHBOARD_PROJECT=${{ vars.DASHBOARD_PROJECT || 'web-app' }} \
          CI_BRANCH=${{ github.ref_name }} CI_COMMIT=${{ github.sha }} \
          npm run ingest
      - name: Upload HTML report (artifact)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: _tests_/playwright-tests/playwright-report/**
```

### Cypress (mochawesome HTML + JSON → ingest + upload)
```yaml
name: e2e-cypress
on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: _tests_/cypress-tests/package-lock.json
      - name: Install deps
        run: |
          cd _tests_/cypress-tests
          npm ci
      - name: Run Cypress (allow failures)
        run: |
          cd _tests_/cypress-tests
          npx cypress run || true
      - name: Ingest results and upload report
        run: |
          cd _tests_/cypress-tests
          DASHBOARD_API=${{ vars.DASHBOARD_API || 'http://localhost:4000' }} \
          DASHBOARD_PROJECT=${{ vars.DASHBOARD_PROJECT || 'web-app' }} \
          CI_BRANCH=${{ github.ref_name }} CI_COMMIT=${{ github.sha }} \
          npm run ingest
      - name: Upload HTML report (artifact)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-report
          path: _tests_/cypress-tests/reports/**
```

- **Set variables**: define `DASHBOARD_API` and `DASHBOARD_PROJECT` in GitHub Actions “Variables” (or “Secrets” if private).
- **Branch/commit**: the ingestion scripts pick `CI_BRANCH` and `CI_COMMIT` if provided.
- **Self-hosted API**: ensure the API endpoint is reachable from runners (e.g., public URL or tunnel).
