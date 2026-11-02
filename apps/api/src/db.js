import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_FILE || path.join(here, '..', 'data', 'mvela.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'English', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id),
  type TEXT NOT NULL, number_masked TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'ZMW',
  balance_ngwee INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id),
  account_id TEXT NOT NULL REFERENCES accounts(id), last4 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', expiry TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
  type TEXT NOT NULL, direction TEXT NOT NULL, amount_ngwee INTEGER NOT NULL,
  counterparty TEXT, channel TEXT NOT NULL, status TEXT NOT NULL,
  failure_code TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id, created_at DESC);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, channel TEXT NOT NULL DEFAULT 'web', language TEXT NOT NULL DEFAULT 'English',
  customer_id TEXT REFERENCES customers(id), state TEXT NOT NULL DEFAULT 'new',
  pending_phone TEXT, pending_message TEXT,
  status TEXT NOT NULL DEFAULT 'open', topic TEXT NOT NULL DEFAULT 'General enquiry',
  source TEXT NOT NULL DEFAULT 'live', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_created ON conversations(created_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'chat', content TEXT NOT NULL,
  latency_ms INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id);
CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, customer_id TEXT NOT NULL,
  code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT, customer_id TEXT,
  actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_conv ON audit_logs(conversation_id, id);
CREATE TABLE IF NOT EXISTS escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL REFERENCES conversations(id),
  reason TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'normal', summary TEXT,
  status TEXT NOT NULL DEFAULT 'open', note TEXT, created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, business TEXT NOT NULL,
  industry TEXT, agents INTEGER, contact_method TEXT, message TEXT, created_at TEXT NOT NULL
);
`);

export const now = () => new Date().toISOString();

export function audit(conversationId, customerId, actor, action, detail) {
  db.prepare('INSERT INTO audit_logs (conversation_id, customer_id, actor, action, detail, created_at) VALUES (?,?,?,?,?,?)')
    .run(conversationId ?? null, customerId ?? null, actor, action, detail == null ? null : JSON.stringify(detail), now());
}

// ------------------------------------------------------------------ companies (multi-tenant)
// Every company that signs up gets its own row here. Conversations, knowledge, escalations, users and
// connectors all carry a company_id, and every dashboard query filters on it.
db.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, widget_key TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'standard', enabled INTEGER NOT NULL DEFAULT 0, color TEXT NOT NULL DEFAULT '#155EEF',
  allowed_domains TEXT NOT NULL DEFAULT '', welcome TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS connectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, description TEXT NOT NULL, url_template TEXT NOT NULL, params TEXT NOT NULL DEFAULT '[]',
  auth_header TEXT, auth_secret_enc TEXT, fields TEXT NOT NULL DEFAULT '[]', enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, UNIQUE (company_id, name)
);
`);
function addColumn(table, col, ddl) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
// Existing rows (from before companies existed) become company 1 through the DEFAULT.
for (const t of ['conversations', 'knowledge', 'escalations']) addColumn(t, 'company_id', 'INTEGER NOT NULL DEFAULT 1');
db.exec('CREATE INDEX IF NOT EXISTS idx_conv_company ON conversations(company_id, created_at DESC); CREATE INDEX IF NOT EXISTS idx_kb_company ON knowledge(company_id); CREATE INDEX IF NOT EXISTS idx_esc_company ON escalations(company_id)');

/** Company 1 is the original business ("sample" mode: demo bank data, OTP verification). Created once; adopts old widget settings. */
(function ensureDefaultCompany() {
  if (db.prepare('SELECT 1 FROM companies WHERE id=1').get()) return;
  let old = null;
  try { old = db.prepare('SELECT * FROM widget_settings WHERE id=1').get(); } catch { /* table does not exist on a fresh database */ }
  db.prepare('INSERT INTO companies (id, name, widget_key, mode, enabled, color, allowed_domains, created_at, updated_at) VALUES (1,?,?,?,?,?,?,?,?)')
    .run(old?.name || process.env.BUSINESS_NAME || 'Demo Bank Zambia', old?.widget_key || 'wk_' + crypto.randomBytes(12).toString('hex'), 'sample',
      old?.enabled ?? 0, old?.color || '#155EEF', old?.allowed_domains || '', now(), now());
})();

export const getCompany = (id) => db.prepare('SELECT * FROM companies WHERE id=?').get(id);
export const companyByKey = (key) => (key ? db.prepare('SELECT * FROM companies WHERE widget_key=?').get(String(key)) : null);
