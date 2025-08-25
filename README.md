# WNDR QA Automation Dashboard

All-in-one dashboard for QA automation KPIs, execution tracking, and report management with comprehensive deployment options.

## Features
- 📊 **Real-time KPI Dashboard** - Test execution metrics, pass/fail rates, coverage trends
- 🔄 **Multi-Framework Support** - Playwright, Cypress, Selenium integration
- 📈 **Historical Analytics** - 3+ years of test data with trend analysis
- 📁 **Report Management** - HTML report upload with local/S3 storage
- 🚀 **Easy Deployment** - Docker-based deployment for local and cloud environments
- ⚡ **Real-time Updates** - Server-Sent Events for live dashboard updates

## Tech Stack
- **API**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: SQLite (development & production ready)
- **Frontend**: Next.js (React + TypeScript) with Recharts
- **Real-time**: Server-Sent Events (SSE)
- **Storage**: Local filesystem or AWS S3 for HTML reports
- **Deployment**: Docker with multi-service orchestration
- **Cloud Ready**: AWS S3 support (GCP & Azure coming soon)

## Quick Start

### Option 1: Docker Deployment (Recommended)

#### Local Deployment
```bash
# 1. Clone the repository
git clone <repository-url>
cd wndr-dashboard

# 2. Create environment file
cp .env.deploy.template .env.deploy
# Edit .env.deploy - comment out REGISTRY for local deployment

# 3. Deploy locally
./scripts/deploy-docker.sh .env.deploy
```

#### EC2 Deployment
```bash
# 1. Create production environment file
cp .env.deploy.template .env.production

# 2. Configure for your EC2 instance
# Edit .env.production:
# - REGISTRY=debasisj/ (default - uses Docker Hub)
# - Set NEXT_PUBLIC_API_BASE_URL=http://your-ec2-ip:4000

# 3. Images are available from debasisj Docker Hub registry
# No need to build - just configure and deploy

# 4. Deploy to EC2
./scripts/deploy-ec2.sh ubuntu@your-ec2-ip ~/.ssh/your-key.pem .env.production
```

### Option 2: Development Mode
```bash
# 1. Install dependencies
cd api && npm install && cd ../web && npm install && cd ..

# 2. Setup database
cd api
cp .env.example .env
npx prisma migrate dev --name init
npm run dev

# 3. Run web UI (in another terminal)
cd ../web
cp .env.example .env.local
npm run dev
```

**Access Points:**
- Web Dashboard: `http://localhost:3000` (local) or `http://your-ec2-ip:3000` (EC2)
- API: `http://localhost:4000` (local) or `http://your-ec2-ip:4000` (EC2)

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

## Storage Configuration

### Local Storage (Default)
Reports are stored on the local filesystem in Docker volumes:
```env
REPORTS_STORAGE=local
```
- **Pros**: Simple setup, no external dependencies
- **Cons**: Limited to single instance, no backup

### AWS S3 Storage
For production deployments with scalability and backup:
```env
REPORTS_STORAGE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```
- **Pros**: Scalable, durable, accessible from multiple instances
- **Cons**: Requires AWS account and configuration

### Cloud Storage Roadmap
🚧 **Coming Soon:**
- **Google Cloud Storage (GCS)** - For Google Cloud Platform deployments
- **Azure Blob Storage** - For Microsoft Azure deployments
- **Multi-cloud support** - Seamless switching between providers

## Seeding Sample Data

To populate your dashboard with realistic test data:

```bash
# For local development
cd api
npx tsx scripts/seed.ts          # Generate 3+ years of test runs
npx tsx scripts/seed_coverage.ts # Generate coverage trends

# For Docker deployment
docker-compose exec api npx tsx scripts/seed.ts
docker-compose exec api npx tsx scripts/seed_coverage.ts

# For EC2 deployment
ssh -i key.pem ubuntu@ip 'cd /home/ubuntu/wndr-dashboard-deploy && docker-compose -f docker-compose.deploy.yml exec -T api npx tsx scripts/seed.ts'
```

## Project Structure
```
api/                    # Express API + Prisma ORM
├── src/               # API source code
├── prisma/            # Database schema & migrations
└── scripts/           # Seed scripts for sample data
web/                    # Next.js frontend
├── app/               # App router pages
└── components/        # Reusable UI components
_tests_/                # Test framework integrations
├── playwright-tests/   # Playwright E2E tests
├── cypress-tests/      # Cypress E2E tests
└── selenium-tests/     # Selenium WebDriver tests
scripts/                # Deployment automation
├── build-images.sh     # Docker image building
├── deploy-docker.sh    # Local Docker deployment
└── deploy-ec2.sh       # EC2 deployment automation
```

## Deployment Architecture

### Local Development
```
┌─────────────────┐    ┌─────────────────┐
│   Web (3000)    │────│   API (4000)    │
│   Next.js       │    │   Express       │
└─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │   Local Files   │
                       └─────────────────┘
```

### Production (EC2 + S3)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web (3000)    │────│   API (4000)    │────│   AWS S3        │
│   Next.js       │    │   Express       │    │   Reports       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │   Docker Volume │
                       └─────────────────┘
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REGISTRY` | Docker registry URL | - | For remote deployment |
| `VERSION` | Image version tag | `latest` | No |
| `API_PORT` | API port mapping | `4000` | No |
| `WEB_PORT` | Web port mapping | `3000` | No |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend API URL | `http://localhost:4000` | Yes (build-time) |
| `REPORTS_STORAGE` | Storage type (`local`/`s3`) | `local` | No |
| `AWS_REGION` | AWS region | - | If using S3 |
| `AWS_ACCESS_KEY_ID` | AWS access key | - | If using S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - | If using S3 |
| `AWS_S3_BUCKET` | S3 bucket name | - | If using S3 |
| `ADMIN_ENABLED` | Enable admin features | `true` | No |
| `ADMIN_TOKEN` | Admin auth token | - | If admin enabled |

## Troubleshooting

### Common Issues

1. **Frontend can't connect to API**
   - Ensure `NEXT_PUBLIC_API_BASE_URL` matches your deployment
   - For EC2: Use public IP, not localhost
   - Rebuild images after changing API URL

2. **Port conflicts**
   - Stop existing containers: `docker-compose down`
   - Check port usage: `netstat -tlnp | grep :3000`

3. **No test data visible**
   - Run seed scripts to generate sample data
   - Check database connection in API logs

4. **File upload fails**
   - Verify storage configuration (local vs S3)
   - Check AWS credentials if using S3
   - Ensure proper file permissions

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

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
