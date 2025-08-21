'use client';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function Page() {
  const [summary, setSummary] = useState<{ totals: { runs: number }, passRate: number, avgDurationMs: number, coveragePctAvg: number | null } | null>(null);
  const [eventsConnected, setEventsConnected] = useState(false);

  const fetchSummary = async () => {
    const res = await fetch(`${apiBase}/api/v1/kpis/summary`, { cache: 'no-cache' });
    setSummary(await res.json());
  };

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

  const cards = useMemo(() => ([
    { label: 'Total Runs', value: summary?.totals.runs ?? '—' },
    { label: 'Pass Rate (last 10)', value: summary ? `${Math.round((summary.passRate || 0) * 100)}%` : '—' },
    { label: 'Avg Duration', value: summary ? formatMs(summary.avgDurationMs) : '—' },
    { label: 'Coverage Avg', value: summary?.coveragePctAvg != null ? `${summary.coveragePctAvg.toFixed(1)}%` : '—' }
  ]), [summary]);

  return (
    <div className="grid">
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
          <TinyTrend endpoint="/api/v1/runs" mapper={(runs) => runs.map((r: any) => ({ name: formatDateShort(r.startedAt), value: r.totalCount ? Math.round((r.passCount / r.totalCount) * 100) : 0 })).reverse()} />
        </div>
        <div className="card">
          <div className="card-title">Duration (ms)</div>
          <TinyTrend endpoint="/api/v1/runs" mapper={(runs) => runs.map((r: any) => ({ name: formatDateShort(r.startedAt), value: r.durationMs })).reverse()} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Run Status Breakdown (by date)</div>
        <StackedStatusChart />
      </div>

      <div className="muted">Realtime: {eventsConnected ? 'connected' : 'disconnected'}</div>
    </div>
  );
}

function TinyTrend({ endpoint, mapper }: { endpoint: string, mapper: (data: any[]) => { name: string | number, value: number }[] }) {
  const [data, setData] = useState<{ name: string | number, value: number }[]>([]);
  useEffect(() => {
    fetch(`${apiBase}${endpoint}`).then(r => r.json()).then(json => setData(mapper(json)));
  }, [endpoint, mapper]);
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f86ff" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#4f86ff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="name" stroke="#a1a7b3" />
          <YAxis stroke="#a1a7b3" />
          <CartesianGrid strokeDasharray="3 3" stroke="#202735" />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#4f86ff" fillOpacity={1} fill="url(#colorValue)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StackedStatusChart() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${apiBase}/api/v1/runs`).then(r => r.json()).then((runs: any[]) => {
      const mapped = runs
        .slice()
        .reverse()
        .map(r => {
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
  }, []);

  return (
    <div style={{ width: '100%', height: 320 }}>
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
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
