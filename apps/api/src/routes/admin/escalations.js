import { Router } from 'express';
import { db, now, audit } from '../../db.js';
import { visitor } from './helpers.js';

const router = Router();

router.get('/', (req, res) => {
  const status = req.query.status === 'resolved' ? 'resolved' : req.query.status === 'all' ? null : 'open';
  const rows = db.prepare(`SELECT e.id, e.conversation_id AS conversationId, e.reason, e.priority, e.summary, e.status, e.note, e.created_at AS createdAt, e.resolved_at AS resolvedAt, cu.name AS customer, c.language
    FROM escalations e JOIN conversations c ON c.id=e.conversation_id LEFT JOIN customers cu ON cu.id=c.customer_id
    WHERE e.company_id=? ${status ? 'AND e.status=?' : ''} ORDER BY CASE e.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, e.created_at DESC LIMIT 100`).all(req.user.companyId, ...(status ? [status] : []));
  res.json(rows.map((x) => ({ ...x, customer: x.customer || visitor(req) })));
});

router.patch('/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM escalations WHERE id=? AND company_id=?').get(req.params.id, req.user.companyId);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const note = String(req.body?.note ?? '').slice(0, 1000) || null;
  db.prepare("UPDATE escalations SET status='resolved', note=?, resolved_at=? WHERE id=?").run(note, now(), e.id);
  db.prepare("UPDATE conversations SET status='human_resolved', updated_at=? WHERE id=?").run(now(), e.conversation_id);
  audit(e.conversation_id, null, 'agent', 'escalation_resolved', { ticket: e.id });
  res.json({ ok: true });
});

export default router;
