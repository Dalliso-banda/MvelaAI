import { Router } from 'express';
import { listConnectors, saveConnector, deleteConnector, testConnector } from '../../customtools.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const guard = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong' }); } };

router.get('/', guard((req) => listConnectors(req.user.companyId)));
router.post('/', guard((req) => ({ id: saveConnector(req.user.companyId, req.body || {}) })));
router.put('/:id', guard((req) => ({ id: saveConnector(req.user.companyId, req.body || {}, Number(req.params.id)) })));
router.delete('/:id', (req, res) => (deleteConnector(req.user.companyId, Number(req.params.id)) ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' })));
router.post('/:id/test', wrap(async (req, res) => {
  try { res.json(await testConnector(req.user.companyId, Number(req.params.id), req.body?.args || {})); }
  catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong' }); }
}));

export default router;
