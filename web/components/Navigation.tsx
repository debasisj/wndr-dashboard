'use client';

// Declare process for TypeScript in client components
declare const process: {
    env: {
        NEXT_PUBLIC_API_BASE_URL?: string;
    };
};

// Next.js makes NEXT_PUBLIC_ env vars available in client components
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function Navigation() {
    return (
        <nav className="nav">
            <a href="/">🏠 <span>Dashboard</span></a>
            <a href="/runs">🧪 <span>Runs</span></a>
            <a href="/analytics">📊 <span>Analytics</span></a>
            <a href="/reports">📄 <span>Reports</span></a>
            <a href="/admin/db">🛠️ <span>Admin DB</span></a>
            <a href={`${apiBase}/api/v1/docs`} target="_blank">📚 <span>API Docs</span></a>
        </nav>
    );
}