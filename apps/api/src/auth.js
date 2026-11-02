import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db, now, audit, getCompany } from './db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'company_id')) {
  db.exec('ALTER TABLE users ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1'); // existing users belong to company 1
}

let cachedSecret;
export function appSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;
  const r = db.prepare("SELECT value FROM settings WHERE key='jwt_secret'").get();
  if (r) return (cachedSecret = r.value);
  cachedSecret = crypto.randomBytes(32).toString('hex'); // generated once, kept in the database
  db.prepare("INSERT INTO settings (key, value) VALUES ('jwt_secret', ?)").run(cachedSecret);
  return cachedSecret;
}

const pub = (u) => {
  const c = getCompany(u.company_id);
  return { id: u.id, email: u.email, name: u.name, role: u.role, companyId: u.company_id, company: c ? { id: c.id, name: c.name, mode: c.mode } : null };
};
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // equalises timing for unknown emails
const token = (u) => jwt.sign({ sub: u.id }, appSecret(), { expiresIn: '12h' });

/** Creates the first owner account (for company 1) if there are no users yet. */
export function bootstrapOwner() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@mvela.local').trim().toLowerCase();
  const given = process.env.ADMIN_PASSWORD;
  const password = given && given.length >= 8 ? given : crypto.randomBytes(9).toString('base64url');
  db.prepare('INSERT INTO users (email, name, password_hash, role, company_id, created_at) VALUES (?,?,?,?,1,?)')
    .run(email, process.env.ADMIN_NAME || 'Owner', bcrypt.hashSync(password, 10), 'owner', now());
  if (process.env.NODE_ENV !== 'test') {
    console.log(`\nFirst owner account created.\n  email:    ${email}\n  password: ${given && given.length >= 8 ? '(from ADMIN_PASSWORD)' : password + '   <- shown once, change ADMIN_PASSWORD in .env'}\n`);
  }
}

/** Returns the signed-in user, or null. Never throws. */
export function userFromRequest(req) {
  try {
    const p = jwt.verify((req.get('authorization') || '').replace(/^Bearer /, ''), appSecret());
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(p.sub);
    return u ? pub(u) : null;
  } catch { return null; }
}

export function requireAuth(req, res, next) {
  const u = userFromRequest(req);
  if (!u) return res.status(401).json({ error: 'Please sign in.' });
  req.user = u;
  next();
}

const limiter = (max, msg) => rateLimit({ windowMs: 15 * 60_000, limit: max, standardHeaders: true, legacyHeaders: false, message: { error: msg } });
const loginLimiter = limiter(Number(process.env.LOGIN_RATE_LIMIT) || 10, 'Too many sign-in attempts. Try again in a few minutes.');
const signupLimiter = rateLimit({ windowMs: 60 * 60_000, limit: Number(process.env.SIGNUP_RATE_LIMIT) || 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-ups from this network. Try again later.' } });

export const authRouter = Router();
authRouter.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 200);
  const password = String(req.body?.password || '').slice(0, 200);
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) { audit(null, null, 'system', 'login_failed', { email }); return res.status(401).json({ error: 'Incorrect email or password.' }); }
  audit(null, null, 'system', 'login', { userId: u.id });
  res.json({ token: token(u), user: pub(u) });
});

// Any company can create its own workspace. Set SIGNUP_ENABLED=false to close this.
authRouter.post('/signup', signupLimiter, async (req, res) => {
  if (process.env.SIGNUP_ENABLED === 'false') return res.status(403).json({ error: 'Sign-up is closed. Contact us for an account.' });
  const b = req.body || {};
  const company = String(b.company ?? '').trim(), name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase(), password = String(b.password ?? '');
  if (company.length < 2 || company.length > 60) return res.status(400).json({ error: 'Enter your company name (2 to 60 characters).' });
  if (!name || name.length > 80) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'That email already has an account. Sign in instead.' });
  const hash = await bcrypt.hash(password, 10);
  const create = db.transaction(() => {
    const c = db.prepare('INSERT INTO companies (name, widget_key, mode, enabled, created_at, updated_at) VALUES (?,?,?,0,?,?)')
      .run(company, 'wk_' + crypto.randomBytes(12).toString('hex'), 'standard', now(), now());
    const u = db.prepare('INSERT INTO users (email, name, password_hash, role, company_id, created_at) VALUES (?,?,?,?,?,?)')
      .run(email, name, hash, 'owner', c.lastInsertRowid, now());
    return { companyId: Number(c.lastInsertRowid), userId: Number(u.lastInsertRowid) };
  });
  const { companyId, userId } = create();
  audit(null, null, 'system', 'company_signup', { companyId, userId });
  res.status(201).json({ token: token({ id: userId }), user: pub(db.prepare('SELECT * FROM users WHERE id=?').get(userId)) });
});
authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
