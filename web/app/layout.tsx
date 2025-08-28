import './globals.css';
import Navigation from '../components/Navigation';

export const metadata = {
  title: 'WNDR Dashboard',
  description: 'QA Automation KPIs',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.svg', sizes: '16x16', type: 'image/svg+xml' }
    ],
    apple: '/favicon.svg'
  },
  manifest: '/site.webmanifest'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-16x16.svg" sizes="16x16" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <span style={{ fontSize: 20 }}>🧭</span>
              <h1 className="brand-title">WNDR QA Dashboard</h1>
            </div>
            <Navigation />
            <footer>© {new Date().getFullYear()} WNDR</footer>
          </aside>
          <main className="content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
