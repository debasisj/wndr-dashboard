'use client';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface Filters {
  project: string;
  since: string;
  until: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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

  const buildQueryString = (filters: Filters, page: number = 1) => {
    const params = new URLSearchParams();
    if (filters.project) params.append('projectKey', filters.project);
    if (filters.since) params.append('since', filters.since);
    if (filters.until) params.append('until', filters.until);
    params.append('page', page.toString());
    return params.toString();
  };

  const load = (page: number = 1) => {
    const queryString = buildQueryString(filters, page);
    fetch(`${apiBase}/api/v1/runs?${queryString}`)
      .then(r => r.json())
      .then(data => {
        setRuns(data.runs || data); // Handle both old and new response format
        setPagination(data.pagination || null);
        setCurrentPage(page);
      });
  };

  const fetchProjects = async () => {
    const res = await fetch(`${apiBase}/api/v1/projects`);
    setProjects(await res.json());
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    load(1); // Reset to page 1 when filters change
  }, [filters]);

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

  const onDelete = async (id: string) => {
    if (!confirm('Delete this run? This cannot be undone.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`${apiBase}/api/v1/runs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      await load(currentPage);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid">
      <div className="header">
        <h2 style={{ margin: 0 }}>Test Runs</h2>
      </div>

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

      {/* Results Summary */}
      {pagination && (
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <strong>Results:</strong> {pagination.totalCount} test runs found
              {(filters.project || filters.since || filters.until) && (
                <span style={{ marginLeft: '0.5rem', color: 'var(--muted)' }}>
                  (filtered)
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }} className="card">
        <table className="table">
          <thead>
            <tr>
              <Th>Started</Th>
              <Th>Project</Th>
              <Th>Suite</Th>
              <Th>Env</Th>
              <Th>Pass</Th>
              <Th>Fail</Th>
              <Th>Skip</Th>
              <Th>Duration</Th>
              <Th>Report</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 0, border: 'none' }}>
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem 2rem',
                    backgroundColor: 'var(--panel-2)',
                    borderRadius: '8px',
                    margin: '1rem',
                    border: '2px dashed var(--border)'
                  }}>
                    <div style={{
                      fontSize: '3rem',
                      marginBottom: '1rem',
                      opacity: 0.3
                    }}>
                      {filters.project || filters.since || filters.until ? '🔍' : '📊'}
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '500',
                      color: 'var(--text)',
                      marginBottom: '0.5rem'
                    }}>
                      {filters.project || filters.since || filters.until ?
                        'No test runs found' :
                        'No test runs yet'}
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: 'var(--muted)',
                      lineHeight: '1.5'
                    }}>
                      {filters.project || filters.since || filters.until ?
                        'Try adjusting your filters or check a different date range.' :
                        'Upload some test results to see them here. Check the integration guide for help.'}
                    </div>
                    {(filters.project || filters.since || filters.until) && (
                      <button
                        onClick={clearFilters}
                        style={{
                          marginTop: '1rem',
                          padding: '0.5rem 1rem',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-2)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              runs.map(r => (
                <tr key={r.id}>
                  <Td>{new Date(r.startedAt).toLocaleString()}</Td>
                  <Td><span className="chip">{r.project?.key || 'Unknown'}</span></Td>
                  <Td>{r.suite}</Td>
                  <Td>{r.env || '-'}</Td>
                  <Td><span className="chip">✅ {r.passCount}</span></Td>
                  <Td><span className="chip">❌ {r.failCount}</span></Td>
                  <Td><span className="chip">⏭️ {r.skipCount}</span></Td>
                  <Td>{formatMs(r.durationMs)}</Td>
                  <Td>{r.reportUrl ? <a className="btn" href={`${apiBase}${r.reportUrl}`} target="_blank">Open</a> : '-'}</Td>
                  <Td>
                    <button className="btn danger" onClick={() => onDelete(r.id)} disabled={busyId === r.id}>{busyId === r.id ? 'Deleting...' : 'Delete'}</button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => load(1)}
              disabled={currentPage === 1}
            >
              First
            </button>
            <button
              className="btn"
              onClick={() => load(currentPage - 1)}
              disabled={!pagination.hasPrev}
            >
              Previous
            </button>

            <span style={{ margin: '0 1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
              Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total runs)
            </span>

            <button
              className="btn"
              onClick={() => load(currentPage + 1)}
              disabled={!pagination.hasNext}
            >
              Next
            </button>
            <button
              className="btn"
              onClick={() => load(pagination.totalPages)}
              disabled={currentPage === pagination.totalPages}
            >
              Last
            </button>
          </div>

          {pagination.totalPages <= 10 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  className={`btn ${pageNum === currentPage ? 'primary' : ''}`}
                  onClick={() => load(pageNum)}
                  style={{ minWidth: '2rem', padding: '0.25rem 0.5rem' }}
                >
                  {pageNum}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td>{children}</td>;
}

function formatMs(ms: number) {
  if (!ms) return '0 ms';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}
