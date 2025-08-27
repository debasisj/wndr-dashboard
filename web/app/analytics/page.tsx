'use client';
import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface QuerySuggestion {
  text: string;
  category: string;
  icon: string;
}

interface AnalyticsResult {
  query: string;
  description: string;
  params: any;
  results: any[];
  count: number;
}

interface FailureDetail {
  runId: string;
  startedAt: string;
  env: string;
  branch: string;
  commitHash: string;
  errorMessage: string;
  browser: string;
  durationMs: number;
  project: string;
}

export default function AnalyticsPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<QuerySuggestion[]>([]);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [failureDetails, setFailureDetails] = useState<FailureDetail[]>([]);
  const [loadingFailures, setLoadingFailures] = useState(false);

  // Load suggestions on component mount
  useState(() => {
    fetch(`${apiBase}/api/v1/analytics/suggestions`)
      .then(r => r.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(console.error);
  });

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch(`${apiBase}/api/v1/analytics/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Query failed');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: QuerySuggestion) => {
    setQuery(suggestion.text);
    handleQuery(suggestion.text);
  };

  const handleTestClick = async (testName: string) => {
    if (expandedTest === testName) {
      setExpandedTest(null);
      setFailureDetails([]);
      return;
    }
    
    setExpandedTest(testName);
    setLoadingFailures(true);
    
    try {
      const response = await fetch(`${apiBase}/api/v1/analytics/test/${encodeURIComponent(testName)}/failures`);
      if (response.ok) {
        const data = await response.json();
        setFailureDetails(data.failures || []);
      }
    } catch (err) {
      console.error('Failed to load failure details:', err);
    } finally {
      setLoadingFailures(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="grid">
      <div className="header">
        <h2 style={{ margin: 0 }}>Test Analytics</h2>
        <p style={{ color: 'var(--muted)', margin: '0.5rem 0 0 0' }}>
          Ask questions about your test data in natural language
        </p>
      </div>

      {/* Query Input */}
      <div className="card">
        <div className="card-title">Ask a Question</div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Show me flaky tests with pass rate less than 50%"
            className="input"
            style={{ flex: 1 }}
            onKeyPress={(e) => e.key === 'Enter' && handleQuery(query)}
          />
          <button 
            onClick={() => handleQuery(query)}
            disabled={loading || !query.trim()}
            className="btn primary"
          >
            {loading ? 'Analyzing...' : 'Ask'}
          </button>
        </div>

        {/* Query Suggestions */}
        {suggestions.length > 0 && !result && (
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
              Try these examples:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="btn"
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '0.25rem 0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span>{suggestion.icon}</span>
                  <span>{suggestion.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          <div style={{ color: 'var(--danger)', fontWeight: '500' }}>
            ❌ Error: {error}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="card">
          <div className="card-title">
            Results: {result.description}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            Found {result.count} results
          </div>

          {result.results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
              No results found for your query. Try adjusting the criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Project</th>
                    <th>Total Runs</th>
                    {result.params.analysisType === 'flaky' && (
                      <>
                        <th>Pass Rate</th>
                        <th>Passes</th>
                        <th>Failures</th>
                      </>
                    )}
                    {result.params.analysisType === 'failing' && (
                      <>
                        <th>Failures</th>
                        <th>Failure Rate</th>
                        <th>Last Failure</th>
                      </>
                    )}
                    {result.params.analysisType === 'slow' && (
                      <>
                        <th>Avg Duration</th>
                        <th>Max Duration</th>
                        <th>Min Duration</th>
                      </>
                    )}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((row: any, index: number) => (
                    <>
                      <tr key={index}>
                        <td>
                          <button
                            onClick={() => handleTestClick(row.name)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                          >
                            {row.name}
                          </button>
                        </td>
                        <td><span className="chip">{row.project}</span></td>
                        <td>{row.total_runs}</td>
                        {result.params.analysisType === 'flaky' && (
                          <>
                            <td>
                              <span className={`chip ${row.pass_rate < 50 ? 'danger' : row.pass_rate < 80 ? 'warning' : ''}`}>
                                {row.pass_rate}%
                              </span>
                            </td>
                            <td><span className="chip">✅ {row.passes}</span></td>
                            <td><span className="chip">❌ {row.failures}</span></td>
                          </>
                        )}
                        {result.params.analysisType === 'failing' && (
                          <>
                            <td><span className="chip">❌ {row.failures}</span></td>
                            <td>
                              <span className="chip danger">
                                {row.failure_rate}%
                              </span>
                            </td>
                            <td>{row.last_failure ? new Date(row.last_failure).toLocaleDateString() : '-'}</td>
                          </>
                        )}
                        {result.params.analysisType === 'slow' && (
                          <>
                            <td>{formatDuration(row.avg_duration)}</td>
                            <td>{formatDuration(row.max_duration)}</td>
                            <td>{formatDuration(row.min_duration)}</td>
                          </>
                        )}
                        <td>
                          <button 
                            onClick={() => handleTestClick(row.name)}
                            className="btn"
                            style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                          >
                            {expandedTest === row.name ? 'Hide Details' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expandable failure details */}
                      {expandedTest === row.name && (
                        <tr>
                          <td colSpan={result.params.analysisType === 'flaky' ? 7 : result.params.analysisType === 'failing' ? 6 : 6}>
                            <div style={{ 
                              padding: '1rem', 
                              backgroundColor: 'var(--panel-2)', 
                              borderRadius: '4px',
                              margin: '0.5rem 0'
                            }}>
                              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>
                                Failure History for "{row.name}"
                              </h4>
                              
                              {loadingFailures ? (
                                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)' }}>
                                  Loading failure details...
                                </div>
                              ) : failureDetails.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)' }}>
                                  No failure details found
                                </div>
                              ) : (
                                <div style={{ overflowX: 'auto' }}>
                                  <table className="table" style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Environment</th>
                                        <th>Browser</th>
                                        <th>Duration</th>
                                        <th>Branch</th>
                                        <th>Error Message</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {failureDetails.map((failure, idx) => (
                                        <tr key={idx}>
                                          <td>{new Date(failure.startedAt).toLocaleString()}</td>
                                          <td>{failure.env || '-'}</td>
                                          <td>{failure.browser || '-'}</td>
                                          <td>{formatDuration(failure.durationMs)}</td>
                                          <td>{failure.branch || '-'}</td>
                                          <td style={{ 
                                            maxWidth: '400px', 
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                            fontSize: '0.75rem',
                                            lineHeight: '1.2'
                                          }}>
                                            {failure.errorMessage || '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}