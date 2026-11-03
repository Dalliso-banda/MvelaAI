import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db, now, audit, getCompany, companyByKey } from '../db.js';
import { createConversation, handleMessage } from '../agent.js';
import { llmProvider } from '../llm.js';
import { DEMO_CUSTOMERS } from '../seed.js';
import { authRouter, userFromRequest } from '../auth.js';
import { widgetPublic } from '../widget.js';
import { mountVoice } from '../voice.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const int = (v, d, min, max) => Math.min(Math.max(parseInt(v, 10) || d, min), max);

router.get('/health', (_req, res) => {
  let dbOk = true; try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
  res.json({ status: dbOk ? 'ok' : 'degraded', service: 'mvela-api', db: dbOk, agent: llmProvider() || 'rules', time: now() });
});

// ------------------------------------------------------------------ public: customer chat
const chatLimiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.CHAT_RATE_LIMIT) || 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many messages, slow down.' } });
const leadLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } });

// Which company a chat belongs to: the widget key if one is given (the company must have published it),
// otherwise the signed-in dashboard user's own company (so they can preview before publishing), otherwise company 1.
function chatCompany(req) {
  const key = req.body?.key;
  if (key) { const c = companyByKey(key); return c?.enabled ? c : null; }
  const u = userFromRequest(req);
  return getCompany(u?.companyId || 1);
}
router.post('/chat/start', chatLimiter, (req, res) => {
  const c = chatCompany(req);
  if (!c) return res.status(404).json({ error: 'Chat is not available.' });
  const { id, greeting } = createConversation({ companyId: c.id });
  res.status(201).json({ conversationId: id, greeting });
});

// Voice: Muse Voice Transcribe turns a recorded utterance into text; the widget then sends that text to /chat.
mountVoice(router, { limiter: rateLimit({ windowMs: 60_000, limit: Number(process.env.VOICE_RATE_LIMIT) || 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many voice messages, slow down.' } }), wrap });

router.post('/chat', chatLimiter, wrap(async (req, res) => {
  const { conversationId, message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'message is required' });
  let id = conversationId;
  if (!id) id = createConversation().id;
  res.json(await handleMessage(id, message));
}));

router.get('/chat/:id', (req, res) => {
  const c = db.prepare('SELECT id, state, status, language FROM conversations WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const messages = db.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id=? ORDER BY id').all(c.id);
  res.json({ ...c, verified: c.state === 'verified', messages });
});

router.post('/contact', leadLimiter, (req, res) => {
  const b = req.body || {};
  const s = (v, n = 200) => String(v ?? '').trim().slice(0, n);
  if (!s(b.name) || !/^\S+@\S+\.\S+$/.test(s(b.email)) || !s(b.business)) return res.status(400).json({ error: 'name, a valid email and business are required' });
  db.prepare('INSERT INTO leads (name, email, business, industry, agents, contact_method, message, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(s(b.name), s(b.email), s(b.business), s(b.industry, 50), int(b.agents, 0, 0, 100000) || null, s(b.contactMethod, 30), s(b.message, 2000), now());
  audit(null, null, 'system', 'lead_created', { business: s(b.business) });
  res.status(201).json({ ok: true });
});

// Demo helper: lists the synthetic customers you can log in as. Disabled when OTP_DEMO=false.
router.get('/demo/customers', (_req, res) => {
  if (process.env.OTP_DEMO === 'false') return res.status(404).json({ error: 'Not found' });
  res.json(DEMO_CUSTOMERS.map(([, name, phone, language]) => ({ name, phone, language })));
});

router.use('/auth', authRouter);
router.use(widgetPublic);

export default router;
