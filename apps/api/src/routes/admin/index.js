import { Router } from 'express';
import { requireAuth } from '../../auth.js';
import { accountRouter, aiRouter, requireRole, settingsRouter, teamRouter } from '../../companyadmin.js';
import { widgetAdmin } from '../../widget.js';
import { seedAll } from '../../seed.js';
import { db } from '../../db.js';
import { platformOnly } from './helpers.js';
import overviewRouter from './overview.js';
import conversationsRouter from './conversations.js';
import escalationsRouter from './escalations.js';
import knowledgeRouter from './knowledge.js';
import connectorsRouter from './connectors.js';

const admin = Router();
admin.use(requireAuth);
// Every query below filters by req.user.companyId. A company can never read or change another company's data.
// Roles: owner and admin manage the company; agents work conversations and escalations.
const adminOnly = requireRole('owner', 'admin');

admin.use('/widget', adminOnly, widgetAdmin);
admin.use('/team', adminOnly, teamRouter);
admin.use('/settings', adminOnly, settingsRouter);
admin.use('/ai-settings', adminOnly, aiRouter);
admin.use('/account', accountRouter);
admin.use('/connectors', adminOnly, connectorsRouter);
admin.use('/knowledge', (req, res, next) => (req.method === 'GET' ? next() : adminOnly(req, res, next)), knowledgeRouter);

admin.use('/overview', overviewRouter);
admin.use('/conversations', conversationsRouter);
admin.use('/escalations', escalationsRouter);
admin.get('/leads', platformOnly, (_req, res) => res.json(db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 100').all()));
admin.post('/reset-demo', platformOnly, (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Disabled in production' });
  seedAll({ reset: true });
  res.json({ ok: true });
});

export default admin;
