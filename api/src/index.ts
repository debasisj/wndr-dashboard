import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { router as v1Router, sseInit } from './routes/v1';

const app = express();

const port = Number(process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '20mb' }));

// Static reports serving
const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'storage', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
app.use('/reports', express.static(reportsDir));

// API routes
app.use('/api/v1', v1Router);

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[api] listening on http://0.0.0.0:${port}`);
});

sseInit(server);
