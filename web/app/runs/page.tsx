'use client';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

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

  const load = (page: number = 1) => {
    fetch(`${apiBase}/api/v1/runs?page=${page}`)
      .then(r => r.json())
      .then(data => {
        setRuns(data.runs || data); // Handle both old and new response format
        setPagination(data.pagination || null);
        setCurrentPage(page);
      });
  };

  useEffect(() => { load(); }, []);

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
        <h2 style={{ margin: 0 }}>Recent Runs</h2>
      </div>
      <div style={{ overflowX: 'auto' }} className="card">
        <table className="table">
          <thead>
            <tr>
              <Th>Started</Th>
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
            {runs.map(r => (
              <tr key={r.id}>
                <Td>{new Date(r.startedAt).toLocaleString()}</Td>
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
            ))}
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

            <span style={{ margin: '0 1rem', fontSize: '0.9rem', color: '#666' }}>
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
