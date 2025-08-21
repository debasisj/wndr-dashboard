'use client';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';




export default function ReportsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [runId, setRunId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string>('');

  useEffect(() => { fetch(`${apiBase}/api/v1/runs`).then(r => r.json()).then(setRuns); }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runId || !file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('runId', runId);
    fd.append('report', file);
    const res = await fetch(`${apiBase}/api/v1/reports/upload`, { method: 'POST', body: fd });
    const json = await res.json();
    setReportUrl(json.reportUrl);
    setUploading(false);
  };

  return (
    <div className="grid">
      <div className="card">
        <h2 className="card-title">Attach HTML Report</h2>
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" value={runId} onChange={e => setRunId(e.target.value)}>
            <option value="">Select Run</option>
            {runs.map(r => (
              <option key={r.id} value={r.id}>{new Date(r.startedAt).toLocaleString()} - {r.suite} ({r.env || '-'})</option>
            ))}
          </select>
          <input className="input" type="file" accept="text/html,.html,.zip" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button className="btn primary" disabled={!runId || !file || uploading} type="submit">{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>
        {reportUrl && (
          <div style={{ marginTop: 12 }}>
            Report uploaded: <a className="btn" href={`${apiBase}${reportUrl}`} target="_blank">Open</a>
          </div>
        )}
      </div>
    </div>
  );
}
