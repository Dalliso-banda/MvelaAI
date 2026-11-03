import { Router } from 'express';
import { db, getCompany } from '../../db.js';
import { int, visitor } from './helpers.js';

const router = Router();

router.get('/', (req, res) => {
  const days = int(req.query.days, 7, 1, 90);
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const handle = getCompany(req.user.companyId)?.handle_minutes || Number(process.env.HANDLE_MINUTES) || 6;
  const cid = req.user.companyId;
  const total = db.prepare('SELECT COUNT(*) c FROM conversations WHERE company_id=? AND created_at>=?').get(cid, since).c;
  const by = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM conversations WHERE company_id=? AND created_at>=? GROUP BY status').all(cid, since).map((x) => [x.status, x.c]));
  const finished = total - (by.open || 0);
  const aiResolved = by.ai_resolved || 0;
  const lat = db.prepare(`SELECT AVG(m.latency_ms) a FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.latency_ms IS NOT NULL AND c.company_id=? AND c.created_at>=?`).get(cid, since).a;
  const langs = db.prepare('SELECT language, COUNT(*) c FROM conversations WHERE company_id=? AND created_at>=? GROUP BY language ORDER BY c DESC').all(cid, since);
  const topics = db.prepare('SELECT topic, COUNT(*) c FROM conversations WHERE company_id=? AND created_at>=? GROUP BY topic ORDER BY c DESC LIMIT 6').all(cid, since);
  const recent = db.prepare(`SELECT c.id, c.topic, c.language, c.status, c.source, c.created_at, cu.name FROM conversations c LEFT JOIN customers cu ON cu.id=c.customer_id
    WHERE c.company_id=? ORDER BY c.created_at DESC LIMIT 8`).all(cid);
  const seeded = db.prepare("SELECT COUNT(*) c FROM conversations WHERE company_id=? AND created_at>=? AND source='seed'").get(cid, since).c;
  res.json({
    days, conversations: total, aiResolutionRate: finished ? Math.round((aiResolved / finished) * 100) : null,
    avgResponseSeconds: lat == null ? null : Math.round(lat / 100) / 10,
    hoursSaved: Math.round(((aiResolved * handle) / 60) * 10) / 10, hoursSavedBasis: `${handle} min per AI-resolved conversation (assumption, change it in Settings)`,
    openEscalations: db.prepare("SELECT COUNT(*) c FROM escalations WHERE company_id=? AND status='open'").get(cid).c,
    languages: langs.map((l) => ({ language: l.language, count: l.c, percent: total ? Math.round((l.c / total) * 100) : 0 })),
    topics: topics.map((t) => ({ topic: t.topic, count: t.c })),
    recent: recent.map((x) => ({ id: x.id, customer: x.name || visitor(req), topic: x.topic, language: x.language, status: x.status, source: x.source, createdAt: x.created_at })),
    seededConversations: seeded,
  });
});

export default router;
