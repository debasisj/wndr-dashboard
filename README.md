# WNDR QA Automation Dashboard

All-in-one dashboard for QA automation KPIs, execution tracking, and report management with comprehensive deployment options.

## Features
- �  **Real-time KPI Dashboard** - Test execution metrics, pass/fail rates, coverage trends
- � **Muloti-Framework Support** - Playwright, Cypress, Selenium integration
- � **Haistorical Analytics** - 3+ years of test data with trend analysis
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



https://github.com/user-attachments/assets/a5009300-9957-4ab1-815a-ee186bbaa7df



## Deployment Options

### Option 1: Docker Hub Deployment (Easiest - Recommended) 🚀

**The easiest way to get started** - Pull pre-built images from Docker Hub and run in containers. No building required!

#### Local Deployment
```bash
# 1. Download deployment files
curl -O https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/docker-compose.deploy.yml
curl -O https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/.env.deploy.template
curl -LO --create-dirs --output-dir scripts https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/scripts/deploy-docker.sh

# 2. Create environment file
cp .env.deploy.template .env.deploy
# REGISTRY=debasisj/ is already configured

# 3. Deploy (automatically pulls from Docker Hub)
chmod +x scripts/deploy-docker.sh
./scripts/deploy-docker.sh .env.deploy
```

#### Cloud Deployment (AWS EC2)
```bash
# 1. Download deployment files
curl -O https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/docker-compose.deploy.yml
curl -O https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/.env.deploy.template
curl -LO --create-dirs --output-dir scripts https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/scripts/deploy-ec2.sh

# 2. Configure for your EC2 instance
cp .env.deploy.template .env.production
# Edit .env.production:
# - Set NEXT_PUBLIC_API_BASE_URL=http://YOUR_EC2_IP:4000

# 3. Deploy to EC2 (automatically pulls from Docker Hub)
chmod +x scripts/deploy-ec2.sh
./scripts/deploy-ec2.sh ubuntu@YOUR_EC2_IP ~/.ssh/your-key.pem .env.production
```

**Available Images on Docker Hub:**
- `debasisj/wndr-dashboard-api:latest` - Backend API (Multi-platform: ARM64 & AMD64)
- `debasisj/wndr-dashboard-web:latest` - Frontend Dashboard (Multi-platform: ARM64 & AMD64)

**Platform Support:**
- ✅ Apple Silicon Macs (ARM64)
- ✅ Intel/AMD Macs & PCs (AMD64)
- ✅ AWS EC2, GCP, Azure (AMD64)
- ✅ AWS Graviton, Raspberry Pi (ARM64)

### Option 2: Clone Repository and Deploy 📦

**For customization or development** - Clone the full repository for local modifications.

```bash
# 1. Clone the repository
git clone <repository-url>
cd wndr-dashboard

# 2. Create environment file
cp .env.deploy.template .env.deploy

# 3. Deploy locally (uses Docker Hub images by default)
./scripts/deploy-docker.sh .env.deploy

# 4. For EC2 deployment
cp .env.deploy.template .env.production
# Edit .env.production with your EC2 IP
./scripts/deploy-ec2.sh ubuntu@your-ec2-ip ~/.ssh/your-key.pem .env.production
```

### Option 3: Development Mode (Advanced)
**For developers who want to modify the code** - Run from source code.

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd wndr-dashboard
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

### Option 4: Build Your Own Docker Images (Contributors)
**For contributors who want to build and publish their own images** - Build multi-platform Docker images.

```bash
# 1. Clone the repository
git clone <repository-url>
cd wndr-dashboard

# 2. Build multi-platform images (ARM64 + AMD64)
# This creates images that work on all platforms
./scripts/build-multiplatform.sh

# Or with a version tag
./scripts/build-multiplatform.sh v1.0.0

# 3. Verify multi-platform support
docker buildx imagetools inspect debasisj/wndr-dashboard-api:latest
docker buildx imagetools inspect debasisj/wndr-dashboard-web:latest
```

**Note:** Multi-platform builds take 5-15 minutes and require Docker Buildx. See [DOCKER_HUB_MULTIPLATFORM.md](DOCKER_HUB_MULTIPLATFORM.md) for detailed instructions.

## Access Points

After deployment, access your dashboard at:
- **Web Dashboard**: `http://localhost:3000` (local) or `http://YOUR_EC2_IP:3000` (cloud)
- **API**: `http://localhost:4000` (local) or `http://YOUR_EC2_IP:4000` (cloud)

## Why Docker Hub Deployment is Easiest

✅ **No building required** - Pre-built images ready to use  
✅ **Minimal setup** - Just download 3 files and run  
✅ **Works anywhere** - Local machine, organization servers, or cloud platforms  
✅ **Multi-platform support** - Same images work on ARM64 (Apple Silicon) and AMD64 (Intel/AMD)  
✅ **Automatic updates** - Always pulls latest stable version  
✅ **Cross-platform** - Works on Windows, macOS, Linux  
✅ **Production ready** - Same images used in production environments

## Deployment Flexibility

**Run containers anywhere:**
- 🏠 **Local Development** - Your laptop/desktop for testing
- 🏢 **Organization Servers** - Internal servers within your company network  
- ☁️ **Cloud Platforms** - AWS EC2, Google Cloud, Azure, DigitalOcean
- 🐳 **Container Orchestration** - Kubernetes, Docker Swarm, ECS

**Currently documented and automated:**
- ✅ **AWS EC2** - Complete automation with `deploy-ec2.sh` script
- 🚧 **GCP & Azure** - Coming soon with similar automation scripts

## Test Framework Integration

The dashboard supports **Playwright**, **Cypress**, and **Selenium** with ready-to-use integration scripts. After running tests, these scripts automatically upload results and HTML reports to your dashboard.

### Playwright Integration

```bash
# 1. Navigate to Playwright tests directory
cd _tests_/playwright-tests

# 2. Install dependencies
npm install

# 3. Configure environment (optional)
export DASHBOARD_API=http://localhost:4000        # Your dashboard API URL
export DASHBOARD_PROJECT=my-web-app               # Project identifier
export TEST_ENV=staging                           # Test environment
export CI_BRANCH=main                             # Git branch
export CI_COMMIT=abc123                           # Git commit hash
export PLAYWRIGHT_BROWSER=chromium                # Browser for analytics (chromium/firefox/webkit)

# 4. Run tests and upload results
npm run e2e                                       # Runs tests + uploads results + reports

# Or run steps separately:
npm run test                                      # Run Playwright tests
npm run ingest                                    # Upload results to dashboard
```

**What happens:**
- Runs Playwright tests with JSON reporter
- Extracts test results from `results.json`
- Uploads detailed test data to dashboard API including:
  - Test name, status, duration, error messages
  - Browser information (from environment variables)
  - Tags extracted from test titles (e.g., "@smoke @regression")
- Uploads HTML report (or ZIP if no index.html)
- Dashboard shows real-time aggregate updates (pass/fail/skip counts)

**📝 Enhanced Data Collection**: Now includes browser info and tags for better analytics!

### Cypress Integration

```bash
# 1. Navigate to Cypress tests directory
cd _tests_/cypress-tests

# 2. Install dependencies
npm install

# 3. Configure environment (optional)
export DASHBOARD_API=http://localhost:4000        # Your dashboard API URL
export DASHBOARD_PROJECT=my-web-app               # Project identifier
export TEST_ENV=production                        # Test environment
export CI_BRANCH=feature/login                    # Git branch
export CI_COMMIT=def456                           # Git commit hash
export CYPRESS_BROWSER=chrome                     # Browser for analytics (chrome/firefox/edge)

# 4. Run tests and upload results
npm run e2e                                       # Runs tests + uploads results + reports

# Or run steps separately:
npm run test                                      # Run Cypress tests
npm run ingest                                    # Upload results to dashboard
```

**What happens:**
- Runs Cypress tests with mochawesome reporter
- Extracts results from `reports/mochawesome.json`
- Uploads detailed test data to dashboard API including:
  - Test name, status, duration, error messages
  - Browser information (from CYPRESS_BROWSER environment variable)
  - Tags extracted from test titles (e.g., "@smoke @regression")
- Uploads HTML report from `reports/mochawesome.html`
- Dashboard updates in real-time with aggregate data

**📝 Enhanced Data Collection**: Now includes browser info and tags for better analytics!

### Selenium Integration

```bash
# 1. Navigate to Selenium tests directory
cd _tests_/selenium-tests

# 2. Install dependencies
npm install

# 3. Configure environment (optional)
export DASHBOARD_API=http://localhost:4000        # Your dashboard API URL
export DASHBOARD_PROJECT=my-selenium-app          # Project identifier
export TEST_ENV=local                             # Test environment
export CI_BRANCH=develop                          # Git branch
export CI_COMMIT=ghi789                           # Git commit hash
export SELENIUM_BROWSER=chrome                    # Browser for analytics (chrome/firefox/safari/edge)

# 4. Run tests and upload results
npm run e2e                                       # Runs tests + uploads results + reports

# Or run steps separately:
npm run test                                      # Run Selenium tests with Mocha
npm run ingest                                    # Upload results to dashboard
```

**What happens:**
- Runs Selenium WebDriver tests with Mocha + mochawesome
- Extracts results from `mochawesome-report/mochawesome.json`
- Uploads detailed test data to dashboard API including:
  - Test name, status, duration, error messages
  - Browser information (from SELENIUM_BROWSER or BROWSER environment variables)
  - Tags extracted from test titles (e.g., "@smoke @regression")
- Uploads HTML report from `mochawesome-report/mochawesome.html`
- Dashboard shows live aggregate updates

**📝 Enhanced Data Collection**: Now includes browser info, tags, and detailed error messages!

### Custom Integration

For other test frameworks, use the REST API directly:

#### Upload Test Results
```bash
curl -X POST http://localhost:4000/api/v1/results \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "my-project",
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
      { "name": "checkout fails", "status": "failed", "durationMs": 3500, "errorMessage": "ValidationError", "browser": "firefox" }
    ]
  }'
```

**Individual Test Case Fields:**
- `name` (required): Test case name (automatically cleaned of tags)
- `status` (required): `"passed"`, `"failed"`, or `"skipped"`
- `durationMs` (required): Test execution time in milliseconds
- `errorMessage` (optional): Error details for failed tests (enhanced with stack traces)
- `browser` (optional): Browser used for the test (auto-detected from environment)
- `tags` (optional): Array of tags extracted from test titles (e.g., ["smoke", "critical"])

**📝 Enhanced Features**: 
- **Auto Tag Extraction**: Tags like "@smoke @regression" are automatically extracted from test names
- **Browser Detection**: Automatically detects browser from environment variables
- **Rich Error Messages**: Includes stack traces and detailed error information
- **Analytics Ready**: All data is now available for the new Analytics dashboard!

#### Upload HTML Report
```bash
# Get runId from previous response, then upload report
curl -X POST http://localhost:4000/api/v1/reports/upload \
  -F "runId=123" \
  -F "report=@path/to/report.html"
```

## Admin Database Interface

The dashboard includes a powerful admin interface for direct database interaction. This is useful for data analysis, cleanup, and advanced queries.

### Enable Admin Features

```bash
# In your .env.deploy or .env.production file:
ADMIN_ENABLED=true
ADMIN_TOKEN=your-secure-admin-token-here
```

**⚠️ Security Note**: Use a strong, unique token. This provides full database access!

### Admin API Endpoints

All admin endpoints require authentication via:
- **Header**: `X-Admin-Token: your-admin-token`
- **Query param**: `?adminToken=your-admin-token`

#### 1. View Database Schema
```bash
curl -H "X-Admin-Token: your-admin-token" \
  http://localhost:4000/api/v1/admin/db/schema
```

**Response:**
```json
{
  "tables": [
    {"name": "Project"},
    {"name": "TestRun"}, 
    {"name": "TestCase"},
    {"name": "_prisma_migrations"}
  ]
}
```

#### 2. Query Database (Read-only)
```bash
curl -X POST http://localhost:4000/api/v1/admin/db/preview \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token" \
  -d '{"sql": "SELECT * FROM TestRun ORDER BY startedAt DESC LIMIT 10"}'
```

**Response:**
```json
{
  "rows": [
    {
      "id": "cm123",
      "projectId": "cm456", 
      "suite": "e2e",
      "env": "staging",
      "passCount": 15,
      "failCount": 2,
      "startedAt": "2025-01-26T10:00:00Z"
    }
  ]
}
```

#### 3. Execute Database Commands (Write operations)
```bash
curl -X POST http://localhost:4000/api/v1/admin/db/execute \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token" \
  -d '{"sql": "DELETE FROM TestRun WHERE startedAt < \"2024-01-01\""}'
```

**Response:**
```json
{
  "result": 25  // Number of affected rows
}
```

### Common Admin Queries

#### View Recent Test Runs
```sql
SELECT 
  p.key as project,
  tr.suite,
  tr.env,
  tr.passCount,
  tr.failCount,
  tr.startedAt
FROM TestRun tr
JOIN Project p ON tr.projectId = p.id
ORDER BY tr.startedAt DESC
LIMIT 20;
```

#### Analyze Pass Rates by Project
```sql
SELECT 
  p.key as project,
  COUNT(*) as total_runs,
  AVG(CAST(tr.passCount AS FLOAT) / (tr.passCount + tr.failCount + tr.skipCount)) * 100 as avg_pass_rate
FROM TestRun tr
JOIN Project p ON tr.projectId = p.id
WHERE tr.startedAt > date('now', '-30 days')
GROUP BY p.key
ORDER BY avg_pass_rate DESC;
```

#### Find Flaky Tests
```sql
SELECT 
  tc.name,
  COUNT(*) as total_runs,
  SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) as passes,
  SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as failures,
  ROUND(AVG(CASE WHEN tc.status = 'passed' THEN 1.0 ELSE 0.0 END) * 100, 2) as pass_rate
FROM TestCase tc
JOIN TestRun tr ON tc.runId = tr.id
WHERE tr.startedAt > date('now', '-7 days')
GROUP BY tc.name
HAVING total_runs >= 5 AND pass_rate > 10 AND pass_rate < 90
ORDER BY pass_rate;
```

#### Clean Up Old Data
```sql
-- Delete test runs older than 1 year
DELETE FROM TestRun WHERE startedAt < date('now', '-1 year');

-- Delete orphaned test cases (if any)
DELETE FROM TestCase WHERE runId NOT IN (SELECT id FROM TestRun);
```

### Database Schema

The dashboard uses these main tables:

- **Project**: Stores project information (`key`, `name`)
- **TestRun**: Stores test execution metadata (`suite`, `env`, `branch`, `passCount`, etc.)
- **TestCase**: Stores individual test case results (`name`, `status`, `durationMs`, `errorMessage`, `browser`, `tags`)

**📝 Note**: Individual test case data is stored and queryable via Admin API, but not yet displayed in the web dashboard. Future releases will include detailed test case visualization, flaky test analysis, and individual test performance metrics.

Use the schema endpoint to explore the full structure and relationships.

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
├── selenium-tests/     # Selenium WebDriver tests
└── shared/             # Shared test utilities
scripts/                # Deployment automation
├── build-images.sh         # Docker image building
├── build-multiplatform.sh  # Multi-platform Docker build (ARM64 + AMD64)
├── deploy-docker.sh        # Local Docker deployment
└── deploy-ec2.sh           # EC2 deployment automation
```

**Key Documentation Files:**
- `DEPLOYMENT.md` - Detailed deployment guide
- `DOCKER_HUB_MULTIPLATFORM.md` - Multi-platform Docker image guide
- `MULTIPLATFORM_FIX.md` - Quick fix for platform issues
- `DOCKER_HUB_DEPLOYMENT.md` - Docker Hub deployment instructions

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

1. **Can't pull Docker images**
   - Ensure Docker is installed and running
   - Check internet connection for Docker Hub access
   - Verify image names: `debasisj/wndr-dashboard-api:latest`

2. **Platform/Architecture errors (ARM64/AMD64)**
   - Error: `no matching manifest for linux/arm64/v8` or `linux/amd64`
   - **Solution**: The images are multi-platform and should work automatically
   - Verify: `docker buildx imagetools inspect debasisj/wndr-dashboard-api:latest`
   - You should see both `linux/amd64` and `linux/arm64` platforms
   - See [MULTIPLATFORM_FIX.md](MULTIPLATFORM_FIX.md) for details

3. **Frontend can't connect to API**
   - Ensure `NEXT_PUBLIC_API_BASE_URL` matches your deployment
   - For cloud deployment: Use public IP, not localhost
   - Example: `NEXT_PUBLIC_API_BASE_URL=http://3.27.131.191:4000`

4. **Port conflicts**
   - Stop existing containers: `docker-compose -f docker-compose.deploy.yml down`
   - Check port usage: `netstat -tlnp | grep :3000`
   - Change ports in `.env.deploy`: `API_PORT=4001` `WEB_PORT=3001`

5. **No test data visible**
   - Run seed scripts to generate sample data
   - Check database connection in API logs
   - Verify API is accessible at the configured URL

5. **File upload fails**
   - Verify storage configuration (local vs S3)
   - Check AWS credentials if using S3
   - Ensure proper file permissions in Docker volumes

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Roadmap & Future Enhancements

### 🚧 Coming Soon

#### Individual Test Case Visualization
- **Test Case Details Page**: View individual test results with filtering and search
- **Flaky Test Detection**: Identify tests with inconsistent pass/fail patterns
- **Test Performance Analysis**: Track individual test execution times and trends
- **Browser-specific Results**: Compare test results across different browsers
- **Tag-based Filtering**: Filter and analyze tests by tags (smoke, regression, etc.)

#### Enhanced Analytics
- **Test Case Trends**: Historical performance of individual tests
- **Failure Analysis**: Detailed error message analysis and categorization
- **Test Suite Optimization**: Identify slow tests and optimization opportunities

**Current Status**: Individual test case data is collected and stored, but web visualization is pending. Use the Admin API to query detailed test case information.

## Contributing

We welcome contributions! If you'd like to contribute:

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Install dependencies: `cd api && npm install && cd ../web && npm install`
4. Make your changes
5. Test locally with `npm run dev`

### Building Docker Images
If you're contributing changes that affect the Docker images:

```bash
# Build multi-platform images (required for production)
./scripts/build-multiplatform.sh

# This builds for both ARM64 (Apple Silicon) and AMD64 (Intel/AMD)
# Takes 5-15 minutes but ensures compatibility across all platforms
```

See [DOCKER_HUB_MULTIPLATFORM.md](DOCKER_HUB_MULTIPLATFORM.md) for detailed build instructions.

### Pull Request Guidelines
- Test your changes locally
- Update documentation if needed
- For Docker changes, verify multi-platform builds work
- Include a clear description of your changes

## License
MIT
