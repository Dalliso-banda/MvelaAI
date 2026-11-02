import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db, now, audit } from './db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

let cachedSecret;
function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;
  const r = db.prepare("SELECT value FROM settings WHERE key='jwt_secret'").get();
  if (r) return (cachedSecret = r.value);
  cachedSecret = crypto.randomBytes(32).toString('hex'); // generated once, kept in the database
  db.prepare("INSERT INTO settings (key, value) VALUES ('jwt_secret', ?)").run(cachedSecret);
  return cachedSecret;
}

const pub = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // equalises timing for unknown emails

/** Creates the first owner account if there are no users yet. */
export function bootstrapOwner() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@mvela.local').trim().toLowerCase();
  const given = process.env.ADMIN_PASSWORD;
  const password = given && given.length >= 8 ? given : crypto.randomBytes(9).toString('base64url');
  db.prepare('INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?,?,?)')
    .run(email, process.env.ADMIN_NAME || 'Owner', bcrypt.hashSync(password, 10), 'owner', now());
  if (process.env.NODE_ENV !== 'test') {
    console.log(`\nFirst owner account created.\n  email:    ${email}\n  password: ${given && given.length >= 8 ? '(from ADMIN_PASSWORD)' : password + '   <- shown once, change ADMIN_PASSWORD in .env'}\n`);
  }
}

export function requireAuth(req, res, next) {
  try {
    const p = jwt.verify((req.get('authorization') || '').replace(/^Bearer /, ''), secret());
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(p.sub);
    if (!u) throw new Error('no user');
    req.user = pub(u);
    next();
  } catch { res.status(401).json({ error: 'Please sign in.' }); }
}

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: Number(process.env.LOGIN_RATE_LIMIT) || 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in a few minutes.' } });

export const authRouter = Router();
authRouter.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 200);
  const password = String(req.body?.password || '').slice(0, 200);
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) { audit(null, null, 'system', 'login_failed', { email }); return res.status(401).json({ error: 'Incorrect email or password.' }); }
  audit(null, null, 'system', 'login', { userId: u.id });
  res.json({ token: jwt.sign({ sub: u.id }, secret(), { expiresIn: '12h' }), user: pub(u) });
});
authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
