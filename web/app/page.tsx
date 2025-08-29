'use client';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface Filters {
  project: string;
  since: string;
  until: string;
}

export default function Page() {
  const [summary, setSummary] = useState<{ totals: { runs: number }, passRate: number, avgDurationMs: number, coveragePctAvg: number | null } | null>(null);
  const [eventsConnected, setEventsConnected] = useState(false);
  const [projects, setProjects] = useState<{ id: string, key: string }[]>([]);
  const [filters, setFilters] = useState<Filters>({
    project: '',
    since: '',
    until: ''
  });
  const [formFilters, setFormFilters] = useState<Filters>({
    project: '',
    since: '',
    until: ''
  });

  const buildQueryString = (filters: Filters) => {
    const params = new URLSearchParams();
    if (filters.project) params.append('projectKey', filters.project);
    if (filters.since) params.append('since', filters.since);
    if (filters.until) params.append('until', filters.until);
    return params.toString();
  };

  const fetchSummary = async () => {
    const queryString = buildQueryString(filters);
    const res = await fetch(`${apiBase}/api/v1/kpis/summary${queryString ? `?${queryString}` : ''}`, { cache: 'no-cache' });
    setSummary(await res.json());
  };

  const fetchProjects = async () => {
    const res = await fetch(`${apiBase}/api/v1/projects`);
    setProjects(await res.json());
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [filters]);

  useEffect(() => {
    fetchSummary();
    const es = new EventSource(`${apiBase}/api/v1/events`);
    es.onopen = () => setEventsConnected(true);
    es.onmessage = () => fetchSummary();
    es.addEventListener('run.created', () => fetchSummary());
    es.addEventListener('run.updated', () => fetchSummary());
    es.onerror = () => setEventsConnected(false);
    return () => es.close();
  }, []);

  const handleFormFilterChange = (key: keyof Filters, value: string) => {
    setFormFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setFilters({ ...formFilters });
  };

  const clearFilters = () => {
    const emptyFilters = {
      project: '',
      since: '',
      until: ''
    };
    setFormFilters(emptyFilters);
    setFilters(emptyFilters);
  };

  const cards = useMemo(() => ([
    { label: 'Total Runs', value: summary?.totals.runs ?? '—' },
    { label: 'Pass Rate (last 10)', value: summary ? `${Math.round((summary.passRate || 0) * 100)}%` : '—' },
    { label: 'Avg Duration', value: summary ? formatMs(summary.avgDurationMs) : '—' },
    { label: 'Coverage Avg', value: summary?.coveragePctAvg != null ? `${summary.coveragePctAvg.toFixed(1)}%` : '—' }
  ]), [summary]);

  // Check if database appears to be empty
  const isEmptyDatabase = summary && summary.totals.runs === 0;

  return (
    <div className="grid">
      {/* Empty State Message */}
      {isEmptyDatabase && (
        <div className="card" style={{ backgroundColor: '#1a2332', border: '1px solid #2d3b4e', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px' }}>🚀</span>
            <h3 style={{ margin: 0, color: '#e2e4e9', fontSize: '18px' }}>Welcome to WNDR Dashboard!</h3>
          </div>
          <p style={{ color: '#a1a7b3', lineHeight: '1.6', margin: '0 0 16px 0' }}>
            Your dashboard is ready but no test data has been uploaded yet. The charts and metrics will appear once you start uploading test results.
          </p>
          <div style={{ backgroundColor: '#0f1419', padding: '16px', borderRadius: '6px', border: '1px solid #2d3b4e' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#4f86ff', fontSize: '14px' }}>Getting Started:</h4>
            <ul style={{ color: '#a1a7b3', margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Upload test results using the API endpoints</li>
              <li>Create projects and test runs via the API</li>
              <li>Check the <a href="/admin/db" style={{ color: '#4f86ff', textDecoration: 'none' }}>Admin DB</a> page to view your data</li>
              <li>Visit <a href="http://localhost:4000/api/v1/docs" style={{ color: '#4f86ff', textDecoration: 'none' }}>API Docs</a> for integration details</li>
            </ul>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="card">
        <div className="card-title">Filters</div>
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="project-filter">Project</label>
            <select
              id="project-filter"
              value={formFilters.project}
              onChange={(e) => handleFormFilterChange('project', e.target.value)}
              className="filter-select"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.key}>{p.key}</option>
              ))}
            </select>
          </div>



          <div className="filter-group">
            <label htmlFor="since-filter">Since</label>
            <input
              id="since-filter"
              type="date"
              value={formFilters.since}
              onChange={(e) => handleFormFilterChange('since', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="until-filter">Until</label>
            <input
              id="until-filter"
              type="date"
              value={formFilters.until}
              onChange={(e) => handleFormFilterChange('until', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <button onClick={applyFilters} className="apply-filters-btn">
              Apply Filters
            </button>
          </div>

          <div className="filter-group">
            <button onClick={clearFilters} className="clear-filters-btn">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        {cards.map(c => (
          <div key={c.label} className="card">
            <div className="muted">{c.label}</div>
            <div className="metric">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Pass Rate (trend)</div>
          <TinyTrend filters={filters} endpoint="/api/v1/runs" mapper={(runs) => runs.map((r: any) => ({ name: formatDateShort(r.startedAt), value: r.totalCount ? Math.round((r.passCount / r.totalCount) * 100) : 0 })).reverse()} />
        </div>
        <div className="card">
          <div className="card-title">Duration (ms)</div>
          <TinyTrend filters={filters} endpoint="/api/v1/runs" mapper={(runs) => runs.map((r: any) => ({ name: formatDateShort(r.startedAt), value: r.durationMs })).reverse()} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Run Status Breakdown (by date)</div>
        <StackedStatusChart filters={filters} />
      </div>

      <div className="card">
        <div className="card-title">Test Automation Coverage Progress</div>
        <TestCoverageChart filters={filters} />
      </div>

      <div className="muted">Realtime: {eventsConnected ? 'connected' : 'disconnected'}</div>
    </div>
  );
}

function TinyTrend({ endpoint, mapper, filters }: {
  endpoint: string,
  mapper: (data: any[]) => { name: string | number, value: number }[],
  filters: Filters
}) {
  const [data, setData] = useState<{ name: string | number, value: number }[]>([]);

  const buildQueryString = (filters: Filters) => {
    const params = new URLSearchParams();
    if (filters.project) params.append('projectKey', filters.project);
    if (filters.since) params.append('since', filters.since);
    if (filters.until) params.append('until', filters.until);
    return params.toString();
  };

  useEffect(() => {
    const queryString = buildQueryString(filters);
    fetch(`${apiBase}${endpoint}${queryString ? `?${queryString}` : ''}`)
      .then(r => r.json())
      .then(json => {
        // Handle both old format (array) and new format (object with runs property)
        const runsData = Array.isArray(json) ? json : json.runs || [];
        setData(mapper(runsData));
      });
  }, [endpoint, mapper, filters]);

  return (
    <div style={{ width: '100%', height: 240 }}>
      {data.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#a1a7b3',
          fontSize: '14px',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <span style={{ fontSize: '32px', opacity: 0.5 }}>📊</span>
          <span>No data available</span>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>Upload test results to see trends</span>
        </div>
      ) : (
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f86ff" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#4f86ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#a1a7b3" />
            <YAxis stroke="#a1a7b3" />
            <CartesianGrid strokeDasharray="3 3" stroke="#202735" />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#4f86ff" fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function StackedStatusChart({ filters }: { filters: Filters }) {
  const [data, setData] = useState<any[]>([]);

  const buildQueryString = (filters: Filters) => {
    const params = new URLSearchParams();
    if (filters.project) params.append('projectKey', filters.project);
    if (filters.since) params.append('since', filters.since);
    if (filters.until) params.append('until', filters.until);
    return params.toString();
  };

  useEffect(() => {
    const queryString = buildQueryString(filters);
    fetch(`${apiBase}/api/v1/runs${queryString ? `?${queryString}` : ''}`)
      .then(r => r.json())
      .then((response: any) => {
        // Handle both old format (array) and new format (object with runs property)
        const runs = Array.isArray(response) ? response : response.runs || [];
        const mapped = runs
          .slice()
          .reverse()
          .map((r: { totalCount: any; passCount: any; failCount: any; skipCount: any; startedAt: string | number | Date; }) => {
            const notExecuted = Math.max(0, (r.totalCount || 0) - (r.passCount || 0) - (r.failCount || 0) - (r.skipCount || 0));
            return {
              date: formatDateShort(r.startedAt),
              passed: r.passCount || 0,
              failed: r.failCount || 0,
              skipped: r.skipCount || 0,
              notExecuted
            };
          });
        setData(mapped);
      });
  }, [filters]);

  return (
    <div style={{ width: '100%', height: 320 }}>
      {data.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#a1a7b3',
          fontSize: '14px',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <span style={{ fontSize: '32px', opacity: 0.5 }}>📊</span>
          <span>No test run data available</span>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>Upload test results to see status breakdown</span>
        </div>
      ) : (
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#202735" />
            <XAxis dataKey="date" stroke="#a1a7b3" />
            <YAxis allowDecimals={false} stroke="#a1a7b3" />
            <Tooltip />
            <Legend />
            <Bar dataKey="passed" stackId="s" fill="#22c55e" name="Passed" />
            <Bar dataKey="failed" stackId="s" fill="#ef4444" name="Failed" />
            <Bar dataKey="skipped" stackId="s" fill="#a3a3a3" name="Skipped" />
            <Bar dataKey="notExecuted" stackId="s" fill="#f59e0b" name="Not Executed" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function TestCoverageChart({ filters }: { filters: Filters }) {
  const [data, setData] = useState<any[]>([]);

  const buildQueryString = (filters: Filters) => {
    const params = new URLSearchParams();
    if (filters.project) params.append('projectKey', filters.project);
    if (filters.since) params.append('since', filters.since);
    if (filters.until) params.append('until', filters.until);
    return params.toString();
  };

  useEffect(() => {
    const queryString = buildQueryString(filters);
    fetch(`${apiBase}/api/v1/coverage/history${queryString ? `?${queryString}` : ''}`)
      .then(r => r.json())
      .then((coverageData: any[]) => {
        const mapped = coverageData.map(item => ({
          date: formatDateShort(item.createdAt),
          autoTests: item.autoTestCovered,
          manualTests: item.manualTestCovered,
          totalTests: item.total,
          automationCoverage: item.total > 0 ? Math.round((item.autoTestCovered / item.total) * 100) : 0
        }));
        setData(mapped);
      })
      .catch(err => {
        console.error('Failed to fetch coverage data:', err);
        setData([]);
      });
  }, [filters]);

  return (
    <div style={{ width: '100%', height: 320 }}>
      {data.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#a1a7b3',
          fontSize: '14px',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <span style={{ fontSize: '32px', opacity: 0.5 }}>📈</span>
          <span>No coverage data available</span>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>Upload test coverage data to see automation progress</span>
        </div>
      ) : (
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="autoTestsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="manualTestsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="totalTestsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f86ff" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#4f86ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#202735" />
            <XAxis dataKey="date" stroke="#a1a7b3" />
            <YAxis stroke="#a1a7b3" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#131722',
                border: '1px solid #202735',
                borderRadius: '8px',
                color: '#e8eaed'
              }}
              formatter={(value: any, name: string) => {
                const labelMap: { [key: string]: string } = {
                  autoTests: 'Automated Tests',
                  manualTests: 'Manual Tests',
                  totalTests: 'Total Tests',
                  automationCoverage: 'Automation Coverage'
                };
                const suffix = name === 'automationCoverage' ? '%' : '';
                return [value + suffix, labelMap[name] || name];
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="totalTests"
              stackId="1"
              stroke="#4f86ff"
              fill="url(#totalTestsGradient)"
              name="Total Tests"
            />
            <Area
              type="monotone"
              dataKey="autoTests"
              stackId="2"
              stroke="#22c55e"
              fill="url(#autoTestsGradient)"
              name="Automated Tests"
            />
            <Area
              type="monotone"
              dataKey="manualTests"
              stackId="3"
              stroke="#f59e0b"
              fill="url(#manualTestsGradient)"
              name="Manual Tests"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function formatMs(ms: number) {
  if (!ms) return '0 ms';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function formatDateShort(input: string | number | Date) {
  const d = new Date(input);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
}
