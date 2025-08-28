# Test Results Dashboard API

Complete API documentation for submitting test results and retrieving analytics.

## 📖 Documentation

- **Interactive API Docs**: Visit `http://localhost:4000/api/v1/docs` when running the server
- **OpenAPI Spec**: Available at `http://localhost:4000/api/v1/openapi.yaml`

## 🚀 Quick Start

### 1. Submit Test Results

The primary endpoint for test runners to submit results:

```bash
curl -X POST http://localhost:4000/api/v1/results \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "web-app",
    "run": {
      "suite": "cypress",
      "env": "staging",
      "branch": "main",
      "startedAt": "2024-01-15T10:30:00Z",
      "finishedAt": "2024-01-15T10:35:00Z"
    },
    "cases": [
      {
        "name": "Login flow works correctly",
        "status": "passed",
        "durationMs": 2500,
        "browser": "chrome",
        "tags": ["smoke", "auth"]
      }
    ]
  }'
```

### 2. Upload Test Report

Upload HTML or ZIP reports after submitting results:

```bash
curl -X POST http://localhost:4000/api/v1/reports/upload \
  -F "runId=your-run-id" \
  -F "report=@path/to/report.html"
```

### 3. Get Test Metrics

Retrieve dashboard metrics:

```bash
curl "http://localhost:4000/api/v1/kpis/summary?projectKey=web-app"
```

## 📊 Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/results` | POST | Submit test results |
| `/reports/upload` | POST | Upload test reports |
| `/kpis/summary` | GET | Get test metrics |
| `/runs` | GET | List test runs |
| `/analytics/query` | POST | Natural language queries |

## 🔧 Integration Examples

### Cypress Integration

Your simplified postRun script already handles this:

```typescript
import { ingest, uploadReport, createRun } from '../../shared/postRunUtils';

const run = createRun('cypress', startedAt, finishedAt);
const result = await ingest(run, cases);
await uploadReport(result.runId, htmlPath, 'cypress-report.html');
```

### Playwright Integration

```typescript
const run = createRun('playwright', startedAt, finishedAt);
const result = await ingest(run, cases);
await uploadReport(result.runId, reportPath, 'playwright-report.html');
```

### Custom Integration

```javascript
// Submit results
const response = await fetch('/api/v1/results', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectKey: 'my-project',
    run: {
      suite: 'custom',
      env: 'production',
      branch: 'main',
      startedAt: new Date().toISOString()
    },
    cases: testCases
  })
});

const { runId } = await response.json();

// Upload report if available
if (reportFile) {
  const formData = new FormData();
  formData.append('runId', runId);
  formData.append('report', reportFile);
  
  await fetch('/api/v1/reports/upload', {
    method: 'POST',
    body: formData
  });
}
```

## 🔍 Analytics Queries

Use natural language to query your test data:

```bash
curl -X POST http://localhost:4000/api/v1/analytics/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me flaky tests with pass rate less than 80%"}'
```

Example queries:
- "Find tests failing more than 3 times in last 7 days"
- "Show slowest tests taking more than 30 seconds"
- "Brittle tests in staging environment last 3 months"

## 📈 Real-time Updates

Subscribe to real-time events via Server-Sent Events:

```javascript
const eventSource = new EventSource('/api/v1/events');

eventSource.addEventListener('run.created', (event) => {
  const data = JSON.parse(event.data);
  console.log('New test run:', data.runId);
});

eventSource.addEventListener('run.updated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Test run updated:', data.runId, data.report);
});
```

## 🔒 Authentication

Most endpoints are public. Admin endpoints require the `X-Admin-Token` header:

```bash
curl -H "X-Admin-Token: your-admin-token" \
  http://localhost:4000/api/v1/admin/db/schema
```

## 📝 Data Models

### Test Case Status
- `passed`: Test completed successfully
- `failed`: Test failed with an error
- `skipped`: Test was skipped/pending

### Test Run Fields
- `suite`: Test framework (cypress, playwright, selenium, etc.)
- `env`: Environment (local, staging, production)
- `branch`: Git branch name
- `commit`: Git commit hash
- `startedAt`/`finishedAt`: ISO 8601 timestamps

### Test Case Fields
- `name`: Human-readable test name
- `status`: passed/failed/skipped
- `durationMs`: Test duration in milliseconds
- `errorMessage`: Error details for failed tests
- `browser`: Browser used (chrome, firefox, etc.)
- `tags`: Array of tags for categorization

## 🛠️ Environment Variables

Configure the API behavior:

```bash
# Storage
REPORTS_STORAGE=local          # or 's3'
REPORTS_DIR=./storage/reports  # local storage directory

# Database
DATABASE_URL=file:./dev.db     # SQLite database path

# Admin access
ADMIN_ENABLED=true
ADMIN_TOKEN=your-secret-token

# AWS S3 (if using S3 storage)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
```

## 🐛 Troubleshooting

### Common Issues

1. **400 Bad Request on /results**
   - Check that `projectKey`, `suite`, and `startedAt` are provided
   - Ensure `startedAt` is a valid ISO 8601 timestamp
   - Verify test case `status` is one of: passed, failed, skipped

2. **Upload fails**
   - Ensure you have a valid `runId` from the `/results` response
   - Check file size limits and available disk space

3. **No data in analytics**
   - Verify test results are being submitted successfully
   - Check that timestamps are recent and within query ranges

### Debug Endpoints

- `GET /api/v1/analytics/debug` - Check recent test data
- `GET /api/v1/projects` - List all projects
- `GET /api/v1/suites` - List all test suites

For more detailed information, visit the interactive documentation at `/api/v1/docs` when running the server.