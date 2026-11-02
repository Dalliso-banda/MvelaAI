import { Router } from 'express';
import cors from 'cors';
import { db, now, audit, getCompany, companyByKey } from './db.js';

const domainList = (c) => c.allowed_domains.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const hostAllowed = (c, parent) => {
  const list = domainList(c);
  if (!list.length || !parent) return true; // see README: this is a soft check, not a security boundary
  try { const h = new URL(parent).hostname.toLowerCase(); return list.some((d) => h === d || h.endsWith('.' + d)); } catch { return false; }
};
const webOrigin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
// In development the dashboard reaches the API through a proxy, so point the snippet straight at the API port.
const apiOrigin = (req) => (process.env.PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? `${req.protocol}://${req.get('host')}` : `http://localhost:${process.env.PORT || 4000}`)).replace(/\/$/, '');
const shape = (c, req) => ({ key: c.widget_key, enabled: !!c.enabled, name: c.name, color: c.color, allowedDomains: domainList(c), scriptUrl: `${apiOrigin(req)}/widget.js`, updatedAt: c.updated_at });

// Public: the embed script asks this before showing anything on a customer's website. The key picks the company.
export const widgetPublic = Router();
widgetPublic.get('/widget/config', cors({ origin: '*' }), (req, res) => {
  const c = companyByKey(req.query.key);
  if (!c || !c.enabled) return res.status(404).json({ error: 'Widget not available.' });
  if (!hostAllowed(c, String(req.query.parent || ''))) return res.status(403).json({ error: 'This website is not allowed to show the widget.' });
  res.json({ name: c.name, color: c.color, embedUrl: `${webOrigin()}/embed?key=${c.widget_key}` });
});

// Public: lets this product's own website load its widget (company 1) automatically once it is published.
widgetPublic.get('/widget/default', (req, res) => {
  const c = getCompany(1);
  if (!c?.enabled) return res.status(404).json({ error: 'Widget not published.' });
  res.json({ key: c.widget_key, scriptUrl: `${apiOrigin(req)}/widget.js` });
});

// Admin (behind requireAuth): each user only ever sees and edits their own company's widget.
export const widgetAdmin = Router();
widgetAdmin.get('/', (req, res) => res.json(shape(getCompany(req.user.companyId), req)));
widgetAdmin.put('/', (req, res) => {
  const b = req.body || {};
  const name = String(b.name ?? '').trim();
  const color = String(b.color ?? '');
  const raw = Array.isArray(b.allowedDomains) ? b.allowedDomains : String(b.allowedDomains ?? '').split(',');
  const domains = [...new Set(raw.map((s) => String(s).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[/:].*$/, '')).filter(Boolean))];
  if (!name || name.length > 60) return res.status(400).json({ error: 'Enter a widget name of up to 60 characters.' });
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Choose a valid colour.' });
  if (domains.length > 10 || domains.some((d) => !/^([a-z0-9-]+\.)+[a-z]{2,}$|^localhost$/.test(d))) return res.status(400).json({ error: 'Enter valid domains such as example.com (up to 10).' });
  db.prepare('UPDATE companies SET enabled=?, name=?, color=?, allowed_domains=?, updated_at=? WHERE id=?').run(b.enabled ? 1 : 0, name, color, domains.join(','), now(), req.user.companyId);
  audit(null, null, 'admin', b.enabled ? 'widget_published' : 'widget_unpublished', { by: req.user.id, companyId: req.user.companyId });
  res.json(shape(getCompany(req.user.companyId), req));
});
