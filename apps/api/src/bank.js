// The bank adapter: the ONLY place the agent's tools get customer and account data from.
//   BANK_MODE=demo (default)  reads the local synthetic SQLite data
//   BANK_MODE=http            calls the bank's REST API through the connector registry (see connectors.js)
// Both return identical shapes, and every call runs through the job queue.
import { db } from './db.js';
import { submit } from './queue.js';
import { callConnector } from './connectors.js';

export const bankMode = () => (process.env.BANK_MODE === 'http' ? 'http' : 'demo');
const ngwee = (k) => Math.round(Number(k) * 100);
const ph = (n) => Array.from({ length: n }, () => '?').join(',');
const exampleEmail = (name) => `${String(name).toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;

const TX_SQL = `SELECT t.id, t.type, t.direction, t.amount_ngwee, t.counterparty, t.channel, t.status, t.failure_code, t.created_at,
  a.type || ' ' || a.number_masked AS account_label FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE a.customer_id=?`;

const demo = {
  async lookupCustomer(phone) {
    const c = db.prepare('SELECT id, name, phone FROM customers WHERE phone=?').get(phone);
    return c ? { id: c.id, name: c.name, phone: c.phone, email: exampleEmail(c.name) } : null;
  },
  async accounts(customerId) {
    return db.prepare('SELECT type, number_masked, currency, balance_ngwee, status FROM accounts WHERE customer_id=?').all(customerId);
  },
  async transactions(customerId, { limit = 5, statuses } = {}) {
    const f = statuses?.length ? ` AND t.status IN (${ph(statuses.length)})` : '';
    return db.prepare(`${TX_SQL}${f} ORDER BY t.created_at DESC LIMIT ?`).all(customerId, ...(statuses || []), limit);
  },
  async transaction(customerId, reference) {
    return db.prepare(`${TX_SQL} AND upper(t.id)=upper(?)`).get(customerId, reference) || null;
  },
  async cards(customerId) {
    return db.prepare('SELECT last4, status, expiry FROM cards WHERE customer_id=?').all(customerId);
  },
};

// Maps the bank's own field names and units onto ours. This is where a real bank's quirks get absorbed.
const toTx = (t) => ({
  id: t.reference, type: t.type, direction: t.direction, amount_ngwee: ngwee(t.amount), counterparty: t.counterparty ?? null,
  channel: t.channel, status: t.status, failure_code: t.failure_code ?? null, created_at: t.created_at,
  account_label: [t.account_type, t.account_masked].filter(Boolean).join(' '),
});

const http = {
  async lookupCustomer(phone) {
    const r = await callConnector('bank', 'lookupCustomer', { query: { phone } });
    const c = r?.customer;
    if (!c || (c.status && c.status !== 'active')) return null;
    return { id: String(c.id), name: String(c.name), phone: c.phone || phone, email: c.email || null };
  },
  async accounts(customerId) {
    const r = await callConnector('bank', 'getAccounts', { params: { customerId } });
    return (r?.accounts || []).map((a) => ({ type: a.type, number_masked: a.number_masked, currency: a.currency || 'ZMW', balance_ngwee: ngwee(a.balance), status: a.status || 'active' }));
  },
  async transactions(customerId, { limit = 5, statuses } = {}) {
    const r = await callConnector('bank', 'getTransactions', { params: { customerId }, query: { limit, status: statuses?.join(',') } });
    return (r?.transactions || []).map(toTx);
  },
  async transaction(customerId, reference) {
    const r = await callConnector('bank', 'getTransaction', { params: { customerId, reference } });
    return r?.transaction ? toTx(r.transaction) : null;
  },
  async cards(customerId) {
    const r = await callConnector('bank', 'getCards', { params: { customerId } });
    return (r?.cards || []).map((c) => ({ last4: c.last4, status: c.status, expiry: c.expiry }));
  },
};

const impl = () => (bankMode() === 'http' ? http : demo);
const job = (op, ctx, fn) => submit(`bank.${op}`, fn, { conversationId: ctx?.conversationId ?? null, priority: 5 });

export const lookupCustomerByPhone = (phone, ctx) => job('lookupCustomer', ctx, () => impl().lookupCustomer(phone));
export const getAccounts = (customerId, ctx) => job('getAccounts', ctx, () => impl().accounts(customerId));
export const getTransactions = (customerId, opts, ctx) => job('getTransactions', ctx, () => impl().transactions(customerId, opts));
export const getTransaction = (customerId, reference, ctx) => job('getTransaction', ctx, () => impl().transaction(customerId, reference));
export const getCards = (customerId, ctx) => job('getCards', ctx, () => impl().cards(customerId));
