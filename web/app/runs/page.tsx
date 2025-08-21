'use client';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => fetch(`${apiBase}/api/v1/runs`).then(r => r.json()).then(setRuns);
  useEffect(() => { load(); }, []);

  const onDelete = async (id: string) => {
    if (!confirm('Delete this run? This cannot be undone.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`${apiBase}/api/v1/runs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      await load();
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
                <Td>{r.reportFilename ? <a className="btn" href={`${apiBase}/reports/${r.reportFilename}`} target="_blank">Open</a> : '-'}</Td>
                <Td>
                  <button className="btn danger" onClick={() => onDelete(r.id)} disabled={busyId === r.id}>{busyId === r.id ? 'Deleting...' : 'Delete'}</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
