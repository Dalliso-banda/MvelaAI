import { Router } from 'express';
import { db } from '../../db.js';
import { int, visitor } from './helpers.js';

const router = Router();

router.get('/', (req, res) => {
  const where = ['c.company_id=?'], args = [req.user.companyId];
  if (req.query.status) { where.push('c.status=?'); args.push(String(req.query.status)); }
  if (req.query.q) { where.push('(cu.name LIKE ? OR c.topic LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.content LIKE ?))'); const q = `%${req.query.q}%`; args.push(q, q, q); }
  const rows = db.prepare(`SELECT c.id, c.topic, c.language, c.status, c.source, c.created_at, c.updated_at, cu.name AS customer,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS messages
    FROM conversations c LEFT JOIN customers cu ON cu.id=c.customer_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY c.updated_at DESC LIMIT ?`).all(...args, int(req.query.limit, 50, 1, 200));
  res.json(rows.map((x) => ({ ...x, customer: x.customer || visitor(req) })));
});

router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT c.*, cu.name AS customer FROM conversations c LEFT JOIN customers cu ON cu.id=c.customer_id WHERE c.id=? AND c.company_id=?').get(req.params.id, req.user.companyId);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: c.id, customer: c.customer || visitor(req), topic: c.topic, language: c.language, status: c.status, source: c.source, createdAt: c.created_at,
    messages: db.prepare('SELECT role, content, latency_ms AS latencyMs, created_at AS createdAt FROM messages WHERE conversation_id=? ORDER BY id').all(c.id),
    audit: db.prepare('SELECT actor, action, detail, created_at AS createdAt FROM audit_logs WHERE conversation_id=? ORDER BY id').all(c.id).map((a) => ({ ...a, detail: a.detail ? JSON.parse(a.detail) : null })),
  });
});

export default router;
