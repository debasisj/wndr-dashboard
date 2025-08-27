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

export class NaturalLanguageParser {
  parse(input: string): QueryParams {
    const params: QueryParams = {};
    const lowerInput = input.toLowerCase();

    // 1. Determine analysis type
    if (/flaky|unstable|inconsistent|brittle/i.test(input)) {
      params.analysisType = 'flaky';
    } else if (/slow|slowest|duration|performance|taking.*time/i.test(input)) {
      params.analysisType = 'slow';
    } else if (/failing|failed|broken|error/i.test(input)) {
      params.analysisType = 'failing';
    } else {
      // Default to flaky if no clear type
      params.analysisType = 'flaky';
    }

    // 2. Extract percentage ranges
    const lessThanMatch = input.match(/(?:less than|<)\s*(\d+)%?/i);
    if (lessThanMatch) {
      params.passRateRange = { min: 0, max: parseInt(lessThanMatch[1]) };
    }

    const moreThanMatch = input.match(/(?:more than|>)\s*(\d+)%?/i);
    if (moreThanMatch) {
      params.passRateRange = { min: parseInt(moreThanMatch[1]), max: 100 };
    }

    const betweenMatch = input.match(/between\s*(\d+)%?\s*and\s*(\d+)%?/i);
    if (betweenMatch) {
      params.passRateRange = {
        min: parseInt(betweenMatch[1]),
        max: parseInt(betweenMatch[2])
      };
    }

    // 3. Extract time ranges
    const timePatterns: Record<string, number> = {
      'last 7 days': 7,
      'past 7 days': 7,
      'last week': 7,
      'past week': 7,
      'last 30 days': 30,
      'past 30 days': 30,
      'last month': 30,
      'past month': 30,
      'last 3 months': 90,
      'past 3 months': 90,
      'last 6 months': 180,
      'past 6 months': 180,
      'last year': 365,
      'past year': 365,
      'last 3 years': 1095,
      'past 3 years': 1095
    };

    for (const [phrase, days] of Object.entries(timePatterns)) {
      if (lowerInput.includes(phrase)) {
        params.timeRange = { days };
        break;
      }
    }

    // Extract flexible day patterns like "last 7 days", "past 14 days"
    if (!params.timeRange) {
      const dayMatch = input.match(/(?:last|past)\s+(\d+)\s+days?/i);
      if (dayMatch) {
        params.timeRange = { days: parseInt(dayMatch[1]) };
      }
    }

    // Default time range if none specified
    if (!params.timeRange) {
      params.timeRange = { days: 90 }; // Default to 3 months
    }

    // 4. Extract environments
    const envMatch = input.match(/(?:in|on)\s+(staging|production|dev|test|qa|local)/i);
    if (envMatch) {
      params.environments = [envMatch[1].toLowerCase()];
    }

    // 5. Extract browsers
    const browserMatch = input.match(/(chrome|firefox|safari|edge|webkit|chromium)/i);
    if (browserMatch) {
      params.browsers = [browserMatch[1].toLowerCase()];
    }

    // 6. Extract limits
    const topMatch = input.match(/(?:top|first)\s*(\d+)/i);
    if (topMatch) {
      params.limit = parseInt(topMatch[1]);
    }

    // 7. Extract failure count for failing tests
    const failureCountMatch = input.match(/(?:more\s+than|>\s*|at\s+least)\s*(\d+)\s*(?:times?|failures?)/i);
    if (failureCountMatch && params.analysisType === 'failing') {
      params.minFailures = parseInt(failureCountMatch[1]);
    }

    // Also check for "X times" pattern
    if (!failureCountMatch && params.analysisType === 'failing') {
      const timesMatch = input.match(/(\d+)\s*times?/i);
      if (timesMatch) {
        params.minFailures = parseInt(timesMatch[1]);
      }
    }

    // 8. Extract duration for slow tests
    const durationMatch = input.match(/(?:more than|>\s*)(\d+)\s*seconds?/i);
    if (durationMatch && params.analysisType === 'slow') {
      params.minDuration = parseInt(durationMatch[1]) * 1000; // Convert to ms
    }

    // Set defaults based on analysis type
    this.setDefaults(params);

    return params;
  }

  private setDefaults(params: QueryParams): void {
    switch (params.analysisType) {
      case 'flaky':
        params.minRuns = params.minRuns || 5;
        params.passRateRange = params.passRateRange || { min: 10, max: 90 };
        params.limit = params.limit || 50;
        break;
      case 'failing':
        // Only set minFailures if user didn't specify it - don't set a default threshold
        params.limit = params.limit || 50;
        break;
      case 'slow':
        params.minDuration = params.minDuration || 10000; // 10 seconds
        params.limit = params.limit || 50;
        break;
    }
  }

  // Helper method to get human-readable description of parsed query
  getDescription(params: QueryParams): string {
    const parts: string[] = [];

    switch (params.analysisType) {
      case 'flaky':
        parts.push('Flaky tests');
        if (params.passRateRange) {
          parts.push(`with pass rate ${params.passRateRange.min}%-${params.passRateRange.max}%`);
        }
        break;
      case 'failing':
        parts.push('Failing tests');
        if (params.minFailures && params.minFailures > 1) {
          parts.push(`with at least ${params.minFailures} failures`);
        }
        break;
      case 'slow':
        parts.push('Slow tests');
        if (params.minDuration) {
          parts.push(`taking more than ${params.minDuration / 1000} seconds`);
        }
        break;
    }

    if (params.timeRange) {
      parts.push(`in the last ${params.timeRange.days} days`);
    }

    if (params.environments?.length) {
      parts.push(`in ${params.environments.join(', ')} environment`);
    }

    if (params.browsers?.length) {
      parts.push(`on ${params.browsers.join(', ')} browser`);
    }

    if (params.limit) {
      parts.push(`(top ${params.limit})`);
    }

    return parts.join(' ');
  }
}