// Per-company "lookup" tools. A company describes an HTTP GET endpoint in its dashboard (for example
// https://api.shop.com/orders/{order_id}); the agent can then call it as a tool.
//
// Safety rules enforced here, never by the model:
//  - the URL, headers and secret come only from the company's saved settings, the model supplies just the placeholder values
//  - HTTPS only, and the address is checked AT CONNECT TIME so internal addresses (localhost, 10.x, cloud metadata) are refused
//  - no redirects, 100 KB response cap, 6 s timeout, run through the job queue
//  - only the fields the company allow-listed are ever returned to the model or the customer
//  - the saved secret is encrypted at rest and never returned by any API
import crypto from 'node:crypto';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { db, now, audit } from './db.js';
import { appSecret } from './auth.js';
import { submit } from './queue.js';

const allowPrivate = () => process.env.ALLOW_PRIVATE_CONNECTORS === 'true'; // development and tests only
const MAX_BYTES = 100 * 1024;
const MAX_CALLS_PER_CONVERSATION = 10;
const BLOCKED_HEADERS = new Set(['host', 'content-length', 'transfer-encoding', 'connection', 'cookie', 'upgrade']);

// ---- secrets at rest
const key = () => crypto.createHash('sha256').update(process.env.SECRETS_KEY || appSecret()).digest();
function seal(text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
function unseal(blob) {
  const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// ---- address safety
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    const m = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateAddress(m[1]);
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l);
  }
  return true;
}
const guardedLookup = (host, opts, cb) => {
  dns.lookup(host, { ...opts }, (err, addr, fam) => {
    if (err) return cb(err);
    const list = Array.isArray(addr) ? addr : [{ address: addr, family: fam }];
    if (!allowPrivate() && list.some((a) => isPrivateAddress(a.address))) return cb(new Error('Address not allowed'));
    return Array.isArray(addr) ? cb(null, addr) : cb(null, addr, fam);
  });
};

function safeGet(urlStr, headers, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    // IP-address hosts skip DNS, so the connect-time lookup guard never sees them: check those here.
    const bare = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(bare) && !allowPrivate() && isPrivateAddress(bare)) return reject(Object.assign(new Error('Address not allowed'), { transient: false }));
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'MvelaAI-Connector/1.0', ...headers }, lookup: guardedLookup, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) { res.resume(); return reject(Object.assign(new Error('Redirects are not followed'), { transient: false })); }
      const chunks = []; let size = 0;
      res.on('data', (d) => { size += d.length; if (size > MAX_BYTES) { req.destroy(Object.assign(new Error('Response too large'), { transient: false })); } else chunks.push(d); });
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('Timed out'), { transient: true })));
    req.on('error', (e) => reject(Object.assign(e, { transient: e.transient ?? true })));
    req.end();
  });
}

// ---- validation of what a company types in the dashboard
const NAME_RE = /^[a-z][a-z0-9_]{1,30}$/;
export function validateConnector(b) {
  const out = {};
  const name = String(b.name ?? '').trim().toLowerCase();
  if (!NAME_RE.test(name)) throw badRequest('Name: 2 to 31 characters, lowercase letters, numbers and underscores, starting with a letter (e.g. order_status).');
  out.name = name;
  out.description = String(b.description ?? '').trim().slice(0, 300);
  if (out.description.length < 10) throw badRequest('Describe what this lookup does in a sentence, so the AI knows when to use it.');
  const params = (Array.isArray(b.params) ? b.params : []).map((p) => ({ name: String(p?.name ?? '').trim(), description: String(p?.description ?? '').trim().slice(0, 120) }));
  if (params.length > 4 || params.some((p) => !NAME_RE.test(p.name))) throw badRequest('Parameters: up to 4, named like order_id (lowercase letters, numbers, underscores).');
  out.params = params;
  const tpl = String(b.urlTemplate ?? '').trim().slice(0, 500);
  const used = [...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (used.some((n) => !params.some((p) => p.name === n))) throw badRequest('The URL uses a {placeholder} that is not in the parameters list.');
  let u;
  try { u = new URL(tpl.replace(/\{\w+\}/g, 'x')); } catch { throw badRequest('Enter a full URL, like https://api.yourshop.com/orders/{order_id}'); }
  if (u.protocol !== 'https:' && !(allowPrivate() && u.protocol === 'http:')) throw badRequest('The URL must start with https://');
  if (/\{/.test((tpl.match(/^[a-z]+:\/\/[^/?#]*/i) || [''])[0])) throw badRequest('Placeholders can only be in the path or query, not the website address.');
  if (u.username || u.password) throw badRequest('Do not put credentials in the URL. Use the secret fields below.');
  if (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) && !allowPrivate() && isPrivateAddress(u.hostname.replace(/^\[|\]$/g, ''))) throw badRequest('That address is not allowed.');
  if (!allowPrivate() && (u.hostname === 'localhost' || u.hostname.endsWith('.local') || u.hostname.endsWith('.internal'))) throw badRequest('That address is not allowed.');
  out.urlTemplate = tpl;
  const hdr = String(b.authHeader ?? '').trim();
  if (hdr && (!/^[A-Za-z0-9-]{1,40}$/.test(hdr) || BLOCKED_HEADERS.has(hdr.toLowerCase()))) throw badRequest('That header name is not allowed.');
  out.authHeader = hdr || null;
  const fields = (Array.isArray(b.fields) ? b.fields : String(b.fields ?? '').split(',')).map((f) => String(f).trim()).filter(Boolean);
  if (!fields.length || fields.length > 20 || fields.some((f) => !/^[\w.]{1,60}$/.test(f))) throw badRequest('List the fields the AI may share with customers (1 to 20), like status,estimated_delivery. Everything else is hidden.');
  out.fields = fields;
  return out;
}
const badRequest = (m) => Object.assign(new Error(m), { status: 400 });

// ---- CRUD (always scoped to one company)
const view = (r) => ({ id: r.id, name: r.name, description: r.description, urlTemplate: r.url_template, params: JSON.parse(r.params), authHeader: r.auth_header, hasSecret: Boolean(r.auth_secret_enc), fields: JSON.parse(r.fields), enabled: !!r.enabled });
export const listConnectors = (companyId) => db.prepare('SELECT * FROM connectors WHERE company_id=? ORDER BY name').all(companyId).map(view);
export function saveConnector(companyId, b, id = null) {
  const v = validateConnector(b);
  const secret = typeof b.authSecret === 'string' && b.authSecret ? b.authSecret.slice(0, 500) : null;
  if (v.authHeader && !secret && !id) throw badRequest('Enter the secret value for that header.');
  const dupe = db.prepare('SELECT id FROM connectors WHERE company_id=? AND name=?').get(companyId, v.name);
  if (dupe && dupe.id !== Number(id)) throw badRequest('You already have a lookup with that name.');
  if (id) {
    const cur = db.prepare('SELECT * FROM connectors WHERE id=? AND company_id=?').get(id, companyId);
    if (!cur) throw Object.assign(new Error('Not found'), { status: 404 });
    const enc = !v.authHeader ? null : secret ? seal(secret) : cur.auth_secret_enc; // blank secret on edit keeps the old one
    db.prepare('UPDATE connectors SET name=?, description=?, url_template=?, params=?, auth_header=?, auth_secret_enc=?, fields=?, enabled=? WHERE id=? AND company_id=?')
      .run(v.name, v.description, v.urlTemplate, JSON.stringify(v.params), v.authHeader, enc, JSON.stringify(v.fields), b.enabled === false ? 0 : 1, id, companyId);
    return Number(id);
  }
  if (db.prepare('SELECT COUNT(*) c FROM connectors WHERE company_id=?').get(companyId).c >= 10) throw badRequest('You can have up to 10 lookups.');
  const r = db.prepare('INSERT INTO connectors (company_id, name, description, url_template, params, auth_header, auth_secret_enc, fields, enabled, created_at) VALUES (?,?,?,?,?,?,?,?,1,?)')
    .run(companyId, v.name, v.description, v.urlTemplate, JSON.stringify(v.params), v.authHeader, v.authHeader ? seal(secret) : null, JSON.stringify(v.fields), now());
  return Number(r.lastInsertRowid);
}
export const deleteConnector = (companyId, id) => db.prepare('DELETE FROM connectors WHERE id=? AND company_id=?').run(id, companyId).changes > 0;

// ---- what the model sees
export function toolDeclarations(companyId) {
  return db.prepare('SELECT * FROM connectors WHERE company_id=? AND enabled=1').all(companyId).map((c) => {
    const params = JSON.parse(c.params);
    return {
      name: `lookup_${c.name}`, description: `${c.description} Only call this with values the customer actually gave you.`,
      parameters: { type: 'object', properties: Object.fromEntries(params.map((p) => [p.name, { type: 'string', description: p.description || p.name }])), required: params.map((p) => p.name) },
    };
  });
}

const pick = (obj, path) => path.split('.').reduce((o, k) => (o != null && typeof o === 'object' ? o[k] : undefined), obj);
function filterFields(data, fields) {
  const one = (o) => { const r = {}; for (const f of fields) { const v = pick(o, f); if (v !== undefined && typeof v !== 'function') r[f] = v; } return r; };
  return Array.isArray(data) ? data.slice(0, 10).map(one) : one(data);
}

/** Runs one lookup. Always resolves to a plain object the model can read. */
export async function runCustomTool(ctx, toolName, args = {}) {
  const name = String(toolName).replace(/^lookup_/, '');
  const c = ctx.companyId ? db.prepare('SELECT * FROM connectors WHERE company_id=? AND name=? AND enabled=1').get(ctx.companyId, name) : null;
  if (!c) return { error: `Unknown tool ${toolName}` };
  const used = db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE conversation_id=? AND action LIKE 'tool:lookup_%'").get(ctx.conversationId).n;
  if (used >= MAX_CALLS_PER_CONVERSATION) return { error: 'Too many lookups in this chat. Offer a human agent.' };
  const params = JSON.parse(c.params);
  const values = {};
  for (const p of params) {
    const v = String(args?.[p.name] ?? '').trim();
    if (!v || v.length > 100) return { error: `Missing ${p.name}. Ask the customer for it.` };
    values[p.name] = v;
  }
  const url = c.url_template.replace(/\{(\w+)\}/g, (_m, k) => encodeURIComponent(values[k]));
  const headers = c.auth_header && c.auth_secret_enc ? { [c.auth_header]: unseal(c.auth_secret_enc) } : {};
  try {
    const res = await submit(`connector.${c.name}`, async () => {
      const r = await safeGet(url, headers);
      if (r.status >= 500 || r.status === 429) throw Object.assign(new Error(`HTTP ${r.status}`), { transient: true });
      return r;
    }, { conversationId: ctx.conversationId, priority: 5 });
    if (res.status === 404) return { found: false, note: 'Nothing was found for those details.' };
    if (res.status >= 400) return { error: 'The company system refused that request. Offer a human agent.' };
    let data; try { data = JSON.parse(res.body); } catch { return { error: 'The company system returned something unreadable. Offer a human agent.' }; }
    return { found: true, data: filterFields(data, JSON.parse(c.fields)) };
  } catch (e) {
    audit(ctx.conversationId, null, 'system', 'connector_failed', { connector: c.name, error: String(e.message).slice(0, 120) });
    return { error: 'That system is not responding right now. Say so plainly and offer a human agent.' };
  }
}

/** Dashboard "Test" button: runs a saved lookup with sample values, returns what the AI would see. */
export const testConnector = (companyId, id, args) => {
  const c = db.prepare('SELECT name FROM connectors WHERE id=? AND company_id=?').get(id, companyId);
  if (!c) throw Object.assign(new Error('Not found'), { status: 404 });
  return runCustomTool({ companyId, conversationId: null }, c.name, args);
};
