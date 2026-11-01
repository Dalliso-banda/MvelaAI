import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db, now, audit } from './db.js';
import { createConversation, handleMessage } from './agent.js';
import { llmEnabled } from './llm.js';
import { DEMO_CUSTOMERS, seedAll } from './seed.js';
import { authRouter, requireAuth } from './auth.js';
import { widgetAdmin, widgetPublic } from './widget.js';

const r = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const int = (v, d, min, max) => Math.min(Math.max(parseInt(v, 10) || d, min), max);

r.get('/health', (_req, res) => {
  let dbOk = true; try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
  res.json({ status: dbOk ? 'ok' : 'degraded', service: 'mvela-api', db: dbOk, agent: llmEnabled() ? 'gemini' : 'rules', time: now() });
});

// ------------------------------------------------------------------ public: customer chat
const chatLimiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.CHAT_RATE_LIMIT) || 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many messages, slow down.' } });
const leadLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } });

r.post('/chat/start', chatLimiter, (_req, res) => {
  const { id, greeting } = createConversation();
  res.status(201).json({ conversationId: id, greeting });
});

r.post('/chat', chatLimiter, wrap(async (req, res) => {
  const { conversationId, message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'message is required' });
  let id = conversationId;
  if (!id) id = createConversation().id;
  res.json(await handleMessage(id, message));
}));

r.get('/chat/:id', (req, res) => {
  const c = db.prepare('SELECT id, state, status, language FROM conversations WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const messages = db.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id=? ORDER BY id').all(c.id);
  res.json({ ...c, verified: c.state === 'verified', messages });
});

r.post('/contact', leadLimiter, (req, res) => {
  const b = req.body || {};
  const s = (v, n = 200) => String(v ?? '').trim().slice(0, n);
  if (!s(b.name) || !/^\S+@\S+\.\S+$/.test(s(b.email)) || !s(b.business)) return res.status(400).json({ error: 'name, a valid email and business are required' });
  db.prepare('INSERT INTO leads (name, email, business, industry, agents, contact_method, message, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(s(b.name), s(b.email), s(b.business), s(b.industry, 50), int(b.agents, 0, 0, 100000) || null, s(b.contactMethod, 30), s(b.message, 2000), now());
  audit(null, null, 'system', 'lead_created', { business: s(b.business) });
  res.status(201).json({ ok: true });
});

// Demo helper: lists the synthetic customers you can log in as. Disabled when OTP_DEMO=false.
r.get('/demo/customers', (_req, res) => {
  if (process.env.OTP_DEMO === 'false') return res.status(404).json({ error: 'Not found' });
  res.json(DEMO_CUSTOMERS.map(([, name, phone, language]) => ({ name, phone, language })));
});

// ------------------------------------------------------------------ dashboard (admin)
const admin = Router();
admin.use(requireAuth);
admin.use('/widget', widgetAdmin);

admin.get('/overview', (req, res) => {
  const days = int(req.query.days, 7, 1, 90);
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const handle = Number(process.env.HANDLE_MINUTES) || 6;
  const total = db.prepare('SELECT COUNT(*) c FROM conversations WHERE created_at>=?').get(since).c;
  const by = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM conversations WHERE created_at>=? GROUP BY status').all(since).map((x) => [x.status, x.c]));
  const finished = total - (by.open || 0);
  const aiResolved = by.ai_resolved || 0;
  const lat = db.prepare(`SELECT AVG(m.latency_ms) a FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.latency_ms IS NOT NULL AND c.created_at>=?`).get(since).a;
  const langs = db.prepare('SELECT language, COUNT(*) c FROM conversations WHERE created_at>=? GROUP BY language ORDER BY c DESC').all(since);
  const topics = db.prepare('SELECT topic, COUNT(*) c FROM conversations WHERE created_at>=? GROUP BY topic ORDER BY c DESC LIMIT 6').all(since);
  const recent = db.prepare(`SELECT c.id, c.topic, c.language, c.status, c.source, c.created_at, cu.name FROM conversations c LEFT JOIN customers cu ON cu.id=c.customer_id
    ORDER BY c.created_at DESC LIMIT 8`).all();
  const seeded = db.prepare("SELECT COUNT(*) c FROM conversations WHERE created_at>=? AND source='seed'").get(since).c;
  res.json({
    days, conversations: total, aiResolutionRate: finished ? Math.round((aiResolved / finished) * 100) : null,
    avgResponseSeconds: lat == null ? null : Math.round(lat / 100) / 10,
    hoursSaved: Math.round(((aiResolved * handle) / 60) * 10) / 10, hoursSavedBasis: `${handle} min per AI-resolved conversation (assumption, set HANDLE_MINUTES)`,
    openEscalations: db.prepare("SELECT COUNT(*) c FROM escalations WHERE status='open'").get().c,
    languages: langs.map((l) => ({ language: l.language, count: l.c, percent: total ? Math.round((l.c / total) * 100) : 0 })),
    topics: topics.map((t) => ({ topic: t.topic, count: t.c })),
    recent: recent.map((x) => ({ id: x.id, customer: x.name || 'Unverified visitor', topic: x.topic, language: x.language, status: x.status, source: x.source, createdAt: x.created_at })),
    seededConversations: seeded,
  });
});

admin.get('/conversations', (req, res) => {
  const where = [], args = [];
  if (req.query.status) { where.push('c.status=?'); args.push(String(req.query.status)); }
  if (req.query.q) { where.push('(cu.name LIKE ? OR c.topic LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.content LIKE ?))'); const q = `%${req.query.q}%`; args.push(q, q, q); }
  const rows = db.prepare(`SELECT c.id, c.topic, c.language, c.status, c.source, c.created_at, c.updated_at, cu.name AS customer,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS messages
    FROM conversations c LEFT JOIN customers cu ON cu.id=c.customer_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY c.updated_at DESC LIMIT ?`).all(...args, int(req.query.limit, 50, 1, 200));
  res.json(rows.map((x) => ({ ...x, customer: x.customer || 'Unverified visitor' })));
});

admin.get('/conversations/:id', (req, res) => {
  const c = db.prepare('SELECT c.*, cu.name AS customer FROM conversations c LEFT JOIN customers cu ON cu.id=c.customer_id WHERE c.id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: c.id, customer: c.customer || 'Unverified visitor', topic: c.topic, language: c.language, status: c.status, source: c.source, createdAt: c.created_at,
    messages: db.prepare('SELECT role, content, latency_ms AS latencyMs, created_at AS createdAt FROM messages WHERE conversation_id=? ORDER BY id').all(c.id),
    audit: db.prepare('SELECT actor, action, detail, created_at AS createdAt FROM audit_logs WHERE conversation_id=? ORDER BY id').all(c.id).map((a) => ({ ...a, detail: a.detail ? JSON.parse(a.detail) : null })),
  });
});

admin.get('/escalations', (req, res) => {
  const status = req.query.status === 'resolved' ? 'resolved' : req.query.status === 'all' ? null : 'open';
  const rows = db.prepare(`SELECT e.id, e.conversation_id AS conversationId, e.reason, e.priority, e.summary, e.status, e.note, e.created_at AS createdAt, e.resolved_at AS resolvedAt, cu.name AS customer, c.language
    FROM escalations e JOIN conversations c ON c.id=e.conversation_id LEFT JOIN customers cu ON cu.id=c.customer_id
    ${status ? 'WHERE e.status=?' : ''} ORDER BY CASE e.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, e.created_at DESC LIMIT 100`).all(...(status ? [status] : []));
  res.json(rows.map((x) => ({ ...x, customer: x.customer || 'Unverified visitor' })));
});

admin.patch('/escalations/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM escalations WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const note = String(req.body?.note ?? '').slice(0, 1000) || null;
  db.prepare("UPDATE escalations SET status='resolved', note=?, resolved_at=? WHERE id=?").run(note, now(), e.id);
  db.prepare("UPDATE conversations SET status='human_resolved', updated_at=? WHERE id=?").run(now(), e.conversation_id);
  audit(e.conversation_id, null, 'agent', 'escalation_resolved', { ticket: e.id });
  res.json({ ok: true });
});

admin.get('/knowledge', (_req, res) => res.json(db.prepare('SELECT id, title, body, tags, updated_at AS updatedAt FROM knowledge ORDER BY title').all()));
admin.post('/knowledge', (req, res) => {
  const { title, body, tags = '' } = req.body || {};
  if (!String(title || '').trim() || !String(body || '').trim()) return res.status(400).json({ error: 'title and body are required' });
  const x = db.prepare('INSERT INTO knowledge (title, body, tags, updated_at) VALUES (?,?,?,?)').run(String(title).slice(0, 200), String(body).slice(0, 4000), String(tags).slice(0, 300), now());
  audit(null, null, 'agent', 'knowledge_created', { id: Number(x.lastInsertRowid) });
  res.status(201).json({ id: Number(x.lastInsertRowid) });
});
admin.put('/knowledge/:id', (req, res) => {
  const { title, body, tags = '' } = req.body || {};
  if (!String(title || '').trim() || !String(body || '').trim()) return res.status(400).json({ error: 'title and body are required' });
  const x = db.prepare('UPDATE knowledge SET title=?, body=?, tags=?, updated_at=? WHERE id=?').run(String(title).slice(0, 200), String(body).slice(0, 4000), String(tags).slice(0, 300), now(), req.params.id);
  res.status(x.changes ? 200 : 404).json(x.changes ? { ok: true } : { error: 'Not found' });
});
admin.delete('/knowledge/:id', (req, res) => {
  const x = db.prepare('DELETE FROM knowledge WHERE id=?').run(req.params.id);
  res.status(x.changes ? 200 : 404).json(x.changes ? { ok: true } : { error: 'Not found' });
});

admin.get('/leads', (_req, res) => res.json(db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 100').all()));

admin.post('/reset-demo', (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Disabled in production' });
  seedAll({ reset: true });
  res.json({ ok: true });
});

r.use('/auth', authRouter);
r.use(widgetPublic);
r.use('/admin', admin);

export default r;
