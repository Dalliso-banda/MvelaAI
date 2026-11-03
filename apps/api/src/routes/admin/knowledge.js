import { Router } from 'express';
import { db, now, audit } from '../../db.js';

const router = Router();

router.get('/', (req, res) => res.json(db.prepare('SELECT id, title, body, tags, updated_at AS updatedAt FROM knowledge WHERE company_id=? ORDER BY title').all(req.user.companyId)));
router.post('/', (req, res) => {
  const { title, body, tags = '' } = req.body || {};
  if (!String(title || '').trim() || !String(body || '').trim()) return res.status(400).json({ error: 'title and body are required' });
  if (db.prepare('SELECT COUNT(*) c FROM knowledge WHERE company_id=?').get(req.user.companyId).c >= 500) return res.status(400).json({ error: 'Knowledge base is full (500 articles).' });
  const x = db.prepare('INSERT INTO knowledge (company_id, title, body, tags, updated_at) VALUES (?,?,?,?,?)').run(req.user.companyId, String(title).slice(0, 200), String(body).slice(0, 4000), String(tags).slice(0, 300), now());
  audit(null, null, 'agent', 'knowledge_created', { id: Number(x.lastInsertRowid) });
  res.status(201).json({ id: Number(x.lastInsertRowid) });
});
router.put('/:id', (req, res) => {
  const { title, body, tags = '' } = req.body || {};
  if (!String(title || '').trim() || !String(body || '').trim()) return res.status(400).json({ error: 'title and body are required' });
  const x = db.prepare('UPDATE knowledge SET title=?, body=?, tags=?, updated_at=? WHERE id=? AND company_id=?').run(String(title).slice(0, 200), String(body).slice(0, 4000), String(tags).slice(0, 300), now(), req.params.id, req.user.companyId);
  res.status(x.changes ? 200 : 404).json(x.changes ? { ok: true } : { error: 'Not found' });
});
router.delete('/:id', (req, res) => {
  const x = db.prepare('DELETE FROM knowledge WHERE id=? AND company_id=?').run(req.params.id, req.user.companyId);
  res.status(x.changes ? 200 : 404).json(x.changes ? { ok: true } : { error: 'Not found' });
});

export default router;
