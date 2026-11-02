import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';
import { seedAll } from './seed.js';
import { llmEnabled, llmLabel } from './llm.js';
import { bootstrapOwner } from './auth.js';

const widgetScript = fs.readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8');

// The built web app (npm run build -w apps/web). Override with WEB_DIST if you deploy it elsewhere.
const WEB_DIST = process.env.WEB_DIST || fileURLToPath(new URL('../../web/dist', import.meta.url));
const INDEX_HTML = path.join(WEB_DIST, 'index.html');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  const csp = helmet.contentSecurityPolicy.getDefaultDirectives();
  // "upgrade-insecure-requests" would break the site when it is served over plain http (localhost, or before TLS is set up).
  app.use(helmet({ contentSecurityPolicy: { directives: { ...csp, 'upgrade-insecure-requests': null } } }));
  app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
  app.use(express.json({ limit: '100kb' }));
  bootstrapOwner();

  app.get('/widget.js', (_req, res) => {
    res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Cache-Control': 'public, max-age=300' });
    res.send(widgetScript);
  });
  app.use('/api', routes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // ---- serve the built web app (only if it has been built) ----
  if (fs.existsSync(INDEX_HTML)) {
    app.use('/assets', express.static(path.join(WEB_DIST, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false })); // hashed filenames
    app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
    // Single-page app: any other page is handled by React Router in the browser.
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      if (req.path === '/embed') { // the chat window must be allowed to appear inside customers' websites
        res.removeHeader('X-Frame-Options');
        res.set('Content-Security-Policy', Object.entries({ ...csp, 'upgrade-insecure-requests': null, 'frame-ancestors': ['*'] })
          .filter(([, v]) => v).map(([k, v]) => `${k} ${v.join(' ')}`).join(';'));
      }
      res.sendFile(INDEX_HTML);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.code === 'ENOENT' || err.status === 404) return res.status(404).send('Not found'); // missing /assets file
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
    console.log(fs.existsSync(INDEX_HTML) ? `Serving the web app from ${WEB_DIST}` : `No web build found at ${WEB_DIST} (run: npm run build). API only.`);
    if (process.env.OTP_DEMO !== 'false') console.log('OTP_DEMO is on: codes are shown in chat. Turn off before real use.');
  });
}