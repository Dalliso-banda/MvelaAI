import Database from 'better-sqlite3';
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
