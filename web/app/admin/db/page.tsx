'use client';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function AdminDbPage() {
  const [token, setToken] = useState('change-me');
  const [tables, setTables] = useState<any[]>([]);
  const [sql, setSql] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [execResult, setExecResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSchema = async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/db/schema`, { headers: { 'x-admin-token': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'request_failed');
      setTables(json.tables || []);
    } catch (e: any) { setError(e.message); }
  };

  const preview = async () => {
    setError(null); setRows(null); setExecResult(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/db/preview`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ sql }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'request_failed');
      setRows(json.rows);
    } catch (e: any) { setError(e.message); }
  };

  const execute = async () => {
    setError(null); setRows(null); setExecResult(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/db/execute`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ sql }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'request_failed');
      setExecResult(json.result);
      await loadSchema();
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { loadSchema(); }, []);

  return (
    <div className="grid">
      <div className="card">
        <div className="header"><h2 className="card-title">Admin DB</h2></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <label className="muted">Token</label>
          <input className="input" value={token} onChange={e => setToken(e.target.value)} style={{ width: 320 }} />
          <button className="btn" onClick={loadSchema}>Refresh Schema</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>Tables</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tables.map((t: any) => <span key={t.name} className="chip">{t.name}</span>)}
          </div>
        </div>

        <div>
          <div className="muted" style={{ marginBottom: 8 }}>SQL</div>
          <textarea value={sql} onChange={e => setSql(e.target.value)} rows={8} placeholder="e.g. CREATE TABLE demo(id TEXT); INSERT INTO demo(id) values('1'); SELECT * FROM demo;" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={preview}>Preview</button>
            <button className="btn primary" onClick={execute}>Execute</button>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', marginTop: 12 }}>Error: {error}</div>}

        {rows && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title">Preview Rows</div>
            <Table data={rows} />
          </div>
        )}

        {execResult != null && (
          <div className="muted" style={{ marginTop: 12 }}>Execute result: {String(execResult)}</div>
        )}
      </div>
    </div>
  );
}

function Table({ data }: { data: any[] }) {
  if (!data.length) return <div className="muted">No rows</div>;
  const cols = Object.keys(data[0]);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            {cols.map(c => <th key={c} className="muted">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map(c => <td key={c}>{String(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
