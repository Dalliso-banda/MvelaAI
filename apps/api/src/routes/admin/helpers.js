import { getCompany } from '../../db.js';

export const int = (v, d, min, max) => Math.min(Math.max(parseInt(v, 10) || d, min), max);
export const visitor = (req) => (getCompany(req.user.companyId)?.mode === 'sample' ? 'Unverified visitor' : 'Visitor');
export const platformOnly = (req, res, next) => (getCompany(req.user.companyId)?.mode === 'sample' ? next() : res.status(403).json({ error: 'Not available.' }));
