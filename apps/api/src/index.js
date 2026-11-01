import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes.js';
import { seedAll } from './seed.js';
import { llmEnabled, llmLabel } from './llm.js';
import fs from 'node:fs';
import { bootstrapOwner } from './auth.js';

const widgetScript = fs.readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
  app.use(express.json({ limit: '100kb' }));
  bootstrapOwner();
  app.get('/widget.js', (_req, res) => {
    res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Cache-Control': 'public, max-age=300' });
    res.send(widgetScript);
  });
  app.use('/api', routes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Something went wrong' });
  });
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  seedAll();
  const PORT = process.env.PORT || 4000;
  createApp().listen(PORT, () => {
    console.log(`Mvela API on http://localhost:${PORT}  |  agent: ${llmLabel()}`);
    if (process.env.OTP_DEMO !== 'false') console.log('OTP_DEMO is on: codes are shown in chat. Turn off before real use.');
  });
}
