import { Router } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { db, now, audit } from './db.js';

db.exec(`CREATE TABLE IF NOT EXISTS widget_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), widget_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#155EEF', allowed_domains TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
)`);

function settings() {
  let r = db.prepare('SELECT * FROM widget_settings WHERE id=1').get();
  if (!r) {
    db.prepare('INSERT INTO widget_settings (id, widget_key, name, updated_at) VALUES (1,?,?,?)')
      .run('wk_' + crypto.randomBytes(12).toString('hex'), process.env.BUSINESS_NAME || 'Customer Support', now());
    r = db.prepare('SELECT * FROM widget_settings WHERE id=1').get();
  }
  return r;
}
const domainList = (r) => r.allowed_domains.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const hostAllowed = (r, parent) => {
  const list = domainList(r);
  if (!list.length || !parent) return true; // see README: this is a soft check, not a security boundary
  try { const h = new URL(parent).hostname.toLowerCase(); return list.some((d) => h === d || h.endsWith('.' + d)); } catch { return false; }
};
const webOrigin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
const apiOrigin = (req) => (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const shape = (r, req) => ({ key: r.widget_key, enabled: !!r.enabled, name: r.name, color: r.color, allowedDomains: domainList(r), scriptUrl: `${apiOrigin(req)}/widget.js`, updatedAt: r.updated_at });

// Public: the embed script asks this before showing anything on a customer's website.
export const widgetPublic = Router();
widgetPublic.get('/widget/config', cors({ origin: '*' }), (req, res) => {
  const r = settings();
  if (String(req.query.key || '') !== r.widget_key || !r.enabled) return res.status(404).json({ error: 'Widget not available.' });
  if (!hostAllowed(r, String(req.query.parent || ''))) return res.status(403).json({ error: 'This website is not allowed to show the widget.' });
  res.json({ name: r.name, color: r.color, embedUrl: `${webOrigin()}/embed?key=${r.widget_key}` });
});

// Admin (behind requireAuth): view, edit and publish.
export const widgetAdmin = Router();
widgetAdmin.get('/', (req, res) => res.json(shape(settings(), req)));
widgetAdmin.put('/', (req, res) => {
  const b = req.body || {};
  const name = String(b.name ?? '').trim();
  const color = String(b.color ?? '');
  const raw = Array.isArray(b.allowedDomains) ? b.allowedDomains : String(b.allowedDomains ?? '').split(',');
  const domains = [...new Set(raw.map((s) => String(s).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[/:].*$/, '')).filter(Boolean))];
  if (!name || name.length > 60) return res.status(400).json({ error: 'Enter a widget name of up to 60 characters.' });
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Choose a valid colour.' });
  if (domains.length > 10 || domains.some((d) => !/^([a-z0-9-]+\.)+[a-z]{2,}$|^localhost$/.test(d))) return res.status(400).json({ error: 'Enter valid domains such as example.com (up to 10).' });
  settings();
  db.prepare('UPDATE widget_settings SET enabled=?, name=?, color=?, allowed_domains=?, updated_at=? WHERE id=1').run(b.enabled ? 1 : 0, name, color, domains.join(','), now());
  audit(null, null, 'admin', b.enabled ? 'widget_published' : 'widget_unpublished', { by: req.user?.id });
  res.json(shape(settings(), req));
});
