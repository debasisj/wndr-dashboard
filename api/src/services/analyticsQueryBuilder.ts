interface QueryParams {
  analysisType?: 'flaky' | 'failing' | 'slow';
  passRateRange?: { min: number; max: number };
  timeRange?: { days: number };
  projects?: string[];
  environments?: string[];
  browsers?: string[];
  limit?: number;
  minRuns?: number;
  minFailures?: number;
  minDuration?: number;
}

interface QueryTemplate {
  description: string;
  sql: string;
  defaults: Record<string, any>;
}

export class AnalyticsQueryBuilder {
  private templates: Record<string, QueryTemplate> = {
    flaky: {
      description: "Find tests with inconsistent pass/fail patterns",
      sql: `
        SELECT 
          tc.name,
          CAST(COUNT(*) as INTEGER) as total_runs,
          CAST(SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) as INTEGER) as passes,
          CAST(SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as INTEGER) as failures,
          CAST(SUM(CASE WHEN tc.status = 'skipped' THEN 1 ELSE 0 END) as INTEGER) as skipped,
          ROUND(AVG(CASE WHEN tc.status = 'passed' THEN 1.0 ELSE 0.0 END) * 100, 2) as pass_rate,
          CAST(MAX(tr.startedAt) as INTEGER) as last_run,
          p.key as project,
          CAST(AVG(tc.durationMs) as INTEGER) as avg_duration
        FROM TestCase tc
        JOIN TestRun tr ON tc.runId = tr.id
        JOIN Project p ON tr.projectId = p.id
        WHERE date(datetime(tr.startedAt/1000, 'unixepoch')) > {cutoffDate}
          {projectFilter}
          {environmentFilter}
          {browserFilter}
        GROUP BY tc.name, p.key
        HAVING total_runs >= {minRuns}
          AND pass_rate BETWEEN {minPassRate} AND {maxPassRate}
        ORDER BY pass_rate ASC, failures DESC
        LIMIT {limit}
      `,
      defaults: {
        timeRange: 90,
        minRuns: 5,
        minPassRate: 10,
        maxPassRate: 90,
        limit: 50
      }
    },
    
    failing: {
      description: "Find tests with high failure rates",
      sql: `
        SELECT 
          tc.name,
          CAST(COUNT(*) as INTEGER) as total_runs,
          CAST(SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as INTEGER) as failures,
          CAST(SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) as INTEGER) as passes,
          ROUND(AVG(CASE WHEN tc.status = 'failed' THEN 1.0 ELSE 0.0 END) * 100, 2) as failure_rate,
          CAST(MAX(CASE WHEN tc.status = 'failed' THEN tr.startedAt END) as INTEGER) as last_failure,
          p.key as project,
          CAST(AVG(tc.durationMs) as INTEGER) as avg_duration
        FROM TestCase tc
        JOIN TestRun tr ON tc.runId = tr.id
        JOIN Project p ON tr.projectId = p.id
        WHERE date(datetime(tr.startedAt/1000, 'unixepoch')) > {cutoffDate}
          {projectFilter}
          {environmentFilter}
          {browserFilter}
        GROUP BY tc.name, p.key
        HAVING failures > 0 {minFailuresFilter}
        ORDER BY failures DESC, failure_rate DESC
        LIMIT {limit}
      `,
      defaults: {
        timeRange: 7,  // Default to 7 days for failing tests
        minFailures: 1, // Lower threshold to catch more failing tests
        limit: 50
      }
    },
    
    slow: {
      description: "Find tests with long execution times",
      sql: `
        SELECT 
          tc.name,
          CAST(COUNT(*) as INTEGER) as total_runs,
          CAST(AVG(tc.durationMs) as INTEGER) as avg_duration,
          CAST(MAX(tc.durationMs) as INTEGER) as max_duration,
          CAST(MIN(tc.durationMs) as INTEGER) as min_duration,
          CAST(SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) as INTEGER) as passes,
          CAST(SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as INTEGER) as failures,
          p.key as project
        FROM TestCase tc
        JOIN TestRun tr ON tc.runId = tr.id
        JOIN Project p ON tr.projectId = p.id
        WHERE date(datetime(tr.startedAt/1000, 'unixepoch')) > {cutoffDate}
          AND tc.durationMs > {minDuration}
          {projectFilter}
          {environmentFilter}
          {browserFilter}
        GROUP BY tc.name, p.key
        ORDER BY avg_duration DESC
        LIMIT {limit}
      `,
      defaults: {
        timeRange: 30,
        minDuration: 10000, // 10 seconds
        limit: 50
      }
    }
  };
  
  build(params: QueryParams): string {
    const analysisType = params.analysisType || 'flaky';
    const template = this.templates[analysisType];
    
    if (!template) {
      throw new Error(`Unknown analysis type: ${analysisType}`);
    }
    
    let sql = template.sql;
    const values = { ...template.defaults, ...this.extractValues(params) };
    
    // Calculate cutoff date in JavaScript and format as YYYY-MM-DD
    const timeRange = values.timeRange || template.defaults.timeRange || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0]; // Get just YYYY-MM-DD part
    
    // Replace simple placeholders
    sql = sql.replace(/{(\w+)}/g, (match, key) => {
      if (key === 'cutoffDate') {
        return `'${cutoffDateString}'`;
      }
      return values[key]?.toString() || match;
    });
    
    // Build dynamic filters
    sql = sql.replace('{projectFilter}', this.buildProjectFilter(params.projects));
    sql = sql.replace('{environmentFilter}', this.buildEnvironmentFilter(params.environments));
    sql = sql.replace('{browserFilter}', this.buildBrowserFilter(params.browsers));
    sql = sql.replace('{minFailuresFilter}', this.buildMinFailuresFilter(params.minFailures));
    
    return sql.trim();
  }
  
  private extractValues(params: QueryParams): Record<string, any> {
    const values: Record<string, any> = {};
    
    if (params.timeRange) {
      values.timeRange = params.timeRange.days;
    }
    
    if (params.passRateRange) {
      values.minPassRate = params.passRateRange.min;
      values.maxPassRate = params.passRateRange.max;
    }
    
    if (params.limit) {
      values.limit = params.limit;
    }
    
    if (params.minRuns) {
      values.minRuns = params.minRuns;
    }
    
    if (params.minFailures) {
      values.minFailures = params.minFailures;
    }
    
    if (params.minDuration) {
      values.minDuration = params.minDuration;
    }
    
    return values;
  }
  
  private buildProjectFilter(projects?: string[]): string {
    if (!projects?.length) return '';
    const projectList = projects.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
    return `AND p.key IN (${projectList})`;
  }
  
  private buildEnvironmentFilter(environments?: string[]): string {
    if (!environments?.length) return '';
    const envList = environments.map(e => `'${e.replace(/'/g, "''")}'`).join(',');
    return `AND tr.env IN (${envList})`;
  }
  
  private buildBrowserFilter(browsers?: string[]): string {
    if (!browsers?.length) return '';
    const browserList = browsers.map(b => `'${b.replace(/'/g, "''")}'`).join(',');
    return `AND tc.browser IN (${browserList})`;
  }
  
  private buildMinFailuresFilter(minFailures?: number): string {
    if (!minFailures || minFailures <= 1) return '';
    return `AND failures >= ${minFailures}`;
  }
  
  getTemplate(analysisType: string): QueryTemplate | undefined {
    return this.templates[analysisType];
  }
  
  getSupportedAnalysisTypes(): string[] {
    return Object.keys(this.templates);
  }
}