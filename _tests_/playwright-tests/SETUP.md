# Playwright Auto-Ingestion Setup

## Summary

Successfully migrated Playwright test result ingestion from manual `tsx` script execution to automatic ingestion using Playwright's built-in `globalTeardown` hook.

## What Changed

### Before
- Required running `tsx scripts/postRun.ts` manually after tests
- Used `npm run test && npm run ingest` pattern
- Needed `tsx` as a dependency
- Manual script chaining prone to failures

### After
- Automatic ingestion after every test run
- Built into Playwright's lifecycle via `globalTeardown`
- No need to run separate commands
- Cleaner, more reliable workflow

## Files Changed

### 1. **New File: `global-teardown.ts`**
- Created Playwright global teardown hook
- Automatically runs after all tests complete
- Parses `results.json` and uploads to dashboard
- Handles both HTML and ZIP report uploads
- Graceful error handling (doesn't fail test run if ingestion fails)

### 2. **Updated: `playwright.config.ts`**
```typescript
// Added globalTeardown configuration
globalTeardown: './global-teardown.ts'
```

### 3. **Updated: `package.json`**
Simplified commands:
- `e2e`: Now just `playwright test` (ingestion automatic)
- `e2e-remote`: Simplified to `playwright test` with env vars

## How It Works

1. **Run tests**: `npm run e2e` or `playwright test`
2. **Tests execute**: Playwright runs all tests
3. **Reports generated**: 
   - `results.json` (JSON reporter)
   - `playwright-report/` (HTML reporter)
4. **Auto-ingestion**: `globalTeardown` hook triggers automatically
   - Parses test results
   - Creates test run
   - Uploads results to dashboard API
   - Uploads HTML/ZIP report

## Benefits

✅ **Automatic**: No need to remember to run ingestion script  
✅ **Reliable**: Always runs after tests complete  
✅ **Simpler**: Fewer commands to remember  
✅ **Cleaner**: No manual script chaining with `&&`  
✅ **Robust**: Error handling ensures test failures don't break ingestion  

## Usage

### Local Development
```bash
npm run e2e
# Tests run → Results automatically ingested
```

### Remote Dashboard
```bash
npm run e2e-remote
# Tests run against remote API → Results automatically ingested
```

### Manual Ingestion (if needed)
The old script is still available:
```bash
npm run ingest
```

## CI/CD Integration

In CI/CD pipelines, simply run:
```bash
cd _tests_/playwright-tests
npm run e2e
```

The ingestion happens automatically. No additional steps needed.

## Environment Variables

The global teardown respects all existing environment variables:
- `DASHBOARD_API`: Dashboard API URL (default: http://localhost:4000)
- `DASHBOARD_PROJECT`: Project key (default: web-app)
- `TEST_ENV`: Test environment (default: local)
- `CI_BRANCH`: Branch name
- `CI_COMMIT`: Commit hash
- `CI_BUILD_ID`: Build ID
- `PLAYWRIGHT_BROWSER`: Browser name

## Notes

- The `tsx` dependency is still used by the manual `ingest` script
- Can be removed if you want to fully deprecate manual ingestion
- The `scripts/postRun.ts` file is kept for backward compatibility
- Global teardown runs even if tests fail (using `|| true` not needed anymore)

## Testing the Setup

Run a quick test to verify:
```bash
cd _tests_/playwright-tests
npm run e2e
```

You should see:
1. Tests execute
2. Reports generated
3. Console output: "🔄 Starting test result ingestion..."
4. Console output: "✅ Ingested run: {...}"
5. Console output: "✅ Uploaded HTML report: {...}"
6. Console output: "✅ Test results ingestion completed successfully"

## Troubleshooting

### Ingestion not running
- Check `playwright.config.ts` has `globalTeardown: './global-teardown.ts'`
- Ensure `global-teardown.ts` exists in the correct location
- Verify file is valid TypeScript

### Results not found
- Ensure JSON reporter is configured in `playwright.config.ts`
- Check `results.json` is generated after test run
- Verify file permissions

### Upload failures
- Check `DASHBOARD_API` environment variable
- Verify API is accessible
- Check network connectivity
- Review API logs for errors
