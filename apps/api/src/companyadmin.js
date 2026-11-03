// Per-company administration: team members and roles, company settings, AI style settings, own password.
// Roles: owner (everything), admin (everything except changing roles), agent (conversations and escalations only).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, now, audit, getCompany } from './db.js';

for (const [col, ddl] of [['handle_minutes', 'INTEGER NOT NULL DEFAULT 6'], ['ai_name', "TEXT NOT NULL DEFAULT ''"], ['ai_tone', "TEXT NOT NULL DEFAULT 'friendly'"], ['ai_notes', "TEXT NOT NULL DEFAULT ''"]]) {
  if (!db.prepare('PRAGMA table_info(companies)').all().some((c) => c.name === col)) db.exec(`ALTER TABLE companies ADD COLUMN ${col} ${ddl}`);
}

const RANK = { agent: 1, admin: 2, owner: 3 };
export const requireRole = (...roles) => (req, res, next) => (roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'You need an admin to do that.' }));
const bad = (res, m, s = 400) => res.status(s).json({ error: m });
const memberView = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at });
const tempPassword = () => crypto.randomBytes(9).toString('base64url'); // 12 characters, shown once

// ---------------------------------------------------------------- team
export const teamRouter = Router();
teamRouter.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, name, email, role, created_at FROM users WHERE company_id=? ORDER BY id').all(req.user.companyId).map(memberView));
});
teamRouter.post('/', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name ?? '').trim(), email = String(b.email ?? '').trim().toLowerCase(), role = String(b.role ?? 'agent');
  if (!name || name.length > 80) return bad(res, 'Enter their name.');
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return bad(res, 'Enter a valid email address.');
  if (!(role in RANK) || RANK[role] >= RANK[req.user.role]) return bad(res, role === 'owner' ? 'There can be only one owner.' : 'You can only add people with a lower role than yours.', 403);
  if (db.prepare('SELECT COUNT(*) c FROM users WHERE company_id=?').get(req.user.companyId).c >= 20) return bad(res, 'A team can have up to 20 people.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'That email already has an account.', 409);
  const temp = tempPassword();
  const r = db.prepare('INSERT INTO users (email, name, password_hash, role, company_id, created_at) VALUES (?,?,?,?,?,?)')
    .run(email, name, await bcrypt.hash(temp, 10), role, req.user.companyId, now());
  audit(null, null, 'admin', 'team_member_added', { by: req.user.id, id: Number(r.lastInsertRowid), role });
  res.status(201).json({ user: memberView(db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid)), tempPassword: temp });
});
const target = (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=? AND company_id=?').get(Number(req.params.id), req.user.companyId);
  if (!u) { bad(res, 'Not found', 404); return null; }
  if (u.id === req.user.id) { bad(res, "You can't do that to your own account here."); return null; }
  return u;
};
const outranks = (req, u) => RANK[req.user.role] > RANK[u.role];
teamRouter.patch('/:id', (req, res) => {
  if (req.user.role !== 'owner') return bad(res, 'Only the owner can change roles.', 403);
  const u = target(req, res); if (!u) return;
  const role = String(req.body?.role ?? '');
  if (!['admin', 'agent'].includes(role) || u.role === 'owner') return bad(res, 'Choose admin or agent.');
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, u.id);
  audit(null, null, 'admin', 'team_role_changed', { by: req.user.id, id: u.id, role });
  res.json({ ok: true });
});
teamRouter.post('/:id/reset-password', async (req, res) => {
  const u = target(req, res); if (!u) return;
  if (!outranks(req, u)) return bad(res, 'You can only reset passwords for people with a lower role.', 403);
  const temp = tempPassword();
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(temp, 10), u.id);
  audit(null, null, 'admin', 'team_password_reset', { by: req.user.id, id: u.id });
  res.json({ tempPassword: temp });
});
teamRouter.delete('/:id', (req, res) => {
  const u = target(req, res); if (!u) return;
  if (!outranks(req, u)) return bad(res, 'You can only remove people with a lower role.', 403);
  db.prepare('DELETE FROM users WHERE id=?').run(u.id); // their sign-in stops working immediately
  audit(null, null, 'admin', 'team_member_removed', { by: req.user.id, id: u.id });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- company settings
export const settingsRouter = Router();
const settingsView = (c) => ({ companyName: c.name, welcome: c.welcome, handleMinutes: c.handle_minutes });
settingsRouter.get('/', (req, res) => res.json(settingsView(getCompany(req.user.companyId))));
settingsRouter.put('/', (req, res) => {
  const b = req.body || {};
  const name = String(b.companyName ?? '').trim(), welcome = String(b.welcome ?? '').trim().slice(0, 300);
  const minutes = parseInt(b.handleMinutes, 10);
  if (name.length < 2 || name.length > 60) return bad(res, 'Company name must be 2 to 60 characters.');
  if (!(minutes >= 1 && minutes <= 120)) return bad(res, 'Minutes per query must be between 1 and 120.');
  db.prepare('UPDATE companies SET name=?, welcome=?, handle_minutes=?, updated_at=? WHERE id=?').run(name, welcome, minutes, now(), req.user.companyId);
  audit(null, null, 'admin', 'settings_updated', { by: req.user.id });
  res.json(settingsView(getCompany(req.user.companyId)));
});

// ---------------------------------------------------------------- AI style
export const aiRouter = Router();
const TONES = ['friendly', 'formal', 'concise'];
const aiView = (c) => ({ aiName: c.ai_name, tone: c.ai_tone, notes: c.ai_notes });
aiRouter.get('/', (req, res) => res.json(aiView(getCompany(req.user.companyId))));
aiRouter.put('/', (req, res) => {
  const b = req.body || {};
  const aiName = String(b.aiName ?? '').trim().slice(0, 40), tone = String(b.tone ?? 'friendly'), notes = String(b.notes ?? '').trim();
  if (!TONES.includes(tone)) return bad(res, 'Choose a tone.');
  if (notes.length > 1000) return bad(res, 'Notes can be up to 1000 characters.');
  db.prepare('UPDATE companies SET ai_name=?, ai_tone=?, ai_notes=?, updated_at=? WHERE id=?').run(aiName, tone, notes, now(), req.user.companyId);
  audit(null, null, 'admin', 'ai_settings_updated', { by: req.user.id });
  res.json(aiView(getCompany(req.user.companyId)));
});

// ---------------------------------------------------------------- own account
export const accountRouter = Router();
accountRouter.post('/password', async (req, res) => {
  const current = String(req.body?.current ?? ''), next = String(req.body?.next ?? '');
  if (next.length < 8 || next.length > 200) return bad(res, 'Use a new password of at least 8 characters.');
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!(await bcrypt.compare(current, u.password_hash))) return bad(res, 'Your current password is not right.', 403);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(next, 10), u.id);
  audit(null, null, 'admin', 'password_changed', { by: u.id });
  res.json({ ok: true });
});
