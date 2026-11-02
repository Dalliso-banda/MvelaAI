// The only things the agent can do. All are READ-ONLY except escalate_to_human, which
// opens a ticket for a person. customerId always comes from the verified session, never
// from model-supplied arguments, so one customer can never query another's data.
import { db, now, audit } from './db.js';

export const money = (ngwee) => 'K' + (ngwee / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FAILURES = {
  INSUFFICIENT_FUNDS: ['the account did not have enough available balance when the transfer was attempted', 'Top up the account and try again. No money left the account.'],
  DAILY_LIMIT_EXCEEDED: ['the daily transfer limit was reached', 'You can try again tomorrow, or ask a human agent about a higher limit.'],
  INVALID_RECIPIENT: ['the recipient number or account could not be matched', 'Check the recipient details and try again. No money left the account.'],
  NETWORK_TIMEOUT: ['the mobile network did not confirm the transfer in time', 'If you were debited, the amount is normally reversed automatically within 24 hours. A human agent can trace it if not.'],
  RECIPIENT_LIMIT_EXCEEDED: ['the recipient wallet has reached its receiving limit', 'Ask the recipient to check their wallet limit, or try a smaller amount.'],
};

const ownedAccountIds = (customerId) => db.prepare('SELECT id FROM accounts WHERE customer_id=?').all(customerId).map((r) => r.id);

function txView(t) {
  return {
    reference: t.id, type: t.type, direction: t.direction, amount: money(t.amount_ngwee), counterparty: t.counterparty,
    channel: t.channel, status: t.status, date: t.created_at, account: t.account_label,
    ...(t.failure_code ? { failure_reason: FAILURES[t.failure_code]?.[0] ?? t.failure_code, next_step: FAILURES[t.failure_code]?.[1] } : {}),
    ...(t.status === 'pending' ? { next_step: 'Pending transfers usually complete within a few minutes. If it is still pending after 24 hours it can be traced by a human agent.' } : {}),
    ...(t.status === 'reversed' ? { next_step: 'The amount has been returned to the account.' } : {}),
  };
}

const impl = {
  get_account_summary(ctx) {
    const rows = db.prepare('SELECT type, number_masked, currency, balance_ngwee, status FROM accounts WHERE customer_id=?').all(ctx.customerId);
    return { accounts: rows.map((a) => ({ type: a.type, account: a.number_masked, balance: money(a.balance_ngwee), currency: a.currency, status: a.status })) };
  },

  get_recent_transactions(ctx, { limit = 5 } = {}) {
    const ids = ownedAccountIds(ctx.customerId);
    if (!ids.length) return { transactions: [] };
    const n = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);
    const rows = db.prepare(`SELECT t.*, a.type || ' ' || a.number_masked AS account_label FROM transactions t JOIN accounts a ON a.id=t.account_id
      WHERE t.account_id IN (${ids.map(() => '?').join(',')}) ORDER BY t.created_at DESC LIMIT ?`).all(...ids, n);
    return { transactions: rows.map(txView) };
  },

  get_transaction_status(ctx, { reference, status } = {}) {
    const ids = ownedAccountIds(ctx.customerId);
    if (!ids.length) return { found: false };
    const inIds = ids.map(() => '?').join(',');
    const base = `SELECT t.*, a.type || ' ' || a.number_masked AS account_label FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.account_id IN (${inIds})`;
    let row;
    if (reference) row = db.prepare(`${base} AND upper(t.id)=upper(?)`).get(...ids, String(reference).trim());
    else {
      // Prefer the status the customer asked about; otherwise any failed/pending/reversed one.
      if (['failed', 'pending', 'reversed'].includes(status)) row = db.prepare(`${base} AND t.status=? ORDER BY t.created_at DESC LIMIT 1`).get(...ids, status);
      row ??= db.prepare(`${base} AND t.status IN ('failed','pending','reversed') ORDER BY t.created_at DESC LIMIT 1`).get(...ids);
    }
    if (!row) return { found: false, note: reference ? 'No transaction with that reference on this customer\'s accounts.' : 'No failed, pending or reversed transactions found recently.' };
    return { found: true, transaction: txView(row) };
  },

  get_card_status(ctx) {
    const rows = db.prepare('SELECT last4, status, expiry FROM cards WHERE customer_id=?').all(ctx.customerId);
    return { cards: rows.map((c) => ({ card: `**** ${c.last4}`, status: c.status, expires: c.expiry })) };
  },

  search_knowledge(_ctx, { query = '' } = {}) {
    const terms = String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
    if (!terms.length) return { results: [] };
    const rows = db.prepare('SELECT id, title, body, tags FROM knowledge').all();
    const scored = rows.map((r) => {
      const hay = `${r.title} ${r.tags}`.toLowerCase(), body = r.body.toLowerCase();
      let s = 0; for (const w of terms) { if (hay.includes(w)) s += 3; if (body.includes(w)) s += 1; }
      return { ...r, score: s };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    return { results: scored.map(({ title, body, score }) => ({ title, answer: body, score })) };
  },

  escalate_to_human(ctx, { reason = 'Customer needs a human agent', priority = 'normal' } = {}) {
    const open = db.prepare("SELECT id FROM escalations WHERE conversation_id=? AND status='open'").get(ctx.conversationId);
    if (open) return { escalated: true, ticket: open.id, note: 'Already escalated.' };
    const msgs = db.prepare("SELECT role, content FROM messages WHERE conversation_id=? AND kind='chat' ORDER BY id DESC LIMIT 6").all(ctx.conversationId).reverse();
    const summary = msgs.map((m) => `${m.role === 'customer' ? 'Customer' : 'AI'}: ${m.content}`).join('\n').slice(0, 1500);
    const p = ['low', 'normal', 'high'].includes(priority) ? priority : 'normal';
    const r = db.prepare('INSERT INTO escalations (conversation_id, reason, priority, summary, created_at) VALUES (?,?,?,?,?)')
      .run(ctx.conversationId, String(reason).slice(0, 300), p, summary, now());
    db.prepare("UPDATE conversations SET status='escalated', updated_at=? WHERE id=?").run(now(), ctx.conversationId);
    return { escalated: true, ticket: Number(r.lastInsertRowid) };
  },
};

const STOP = new Set(['the', 'and', 'for', 'what', 'how', 'can', 'you', 'your', 'are', 'with', 'this', 'that', 'have', 'does', 'will', 'about', 'please', 'tell', 'need', 'want', 'when', 'where', 'who']);

// Tools that need a verified customer. search_knowledge is public info only.
const NEEDS_AUTH = new Set(['get_account_summary', 'get_recent_transactions', 'get_transaction_status', 'get_card_status']);

export function runTool(name, args, ctx) {
  if (!impl[name]) return { error: `Unknown tool ${name}` };
  if (NEEDS_AUTH.has(name) && !ctx.customerId) return { error: 'Customer is not verified.' };
  try {
    const out = impl[name](ctx, args || {});
    ctx.used?.push(name);
    audit(ctx.conversationId, ctx.customerId, 'ai', `tool:${name}`, { args: args || {}, ok: true });
    return out;
  } catch (e) {
    audit(ctx.conversationId, ctx.customerId, 'ai', `tool:${name}`, { args: args || {}, ok: false, error: e.message });
    return { error: 'Tool failed' };
  }
}

// Declarations in Gemini functionDeclarations format.
export const TOOL_DECLARATIONS = [
  { name: 'get_account_summary', description: "Balances and status of the verified customer's accounts.", parameters: { type: 'object', properties: {} } },
  { name: 'get_recent_transactions', description: "The verified customer's most recent transactions across all accounts.", parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'How many (1-10). Default 5.' } } } },
  { name: 'get_transaction_status', description: 'Status of one transaction by reference (e.g. TXN-100234). With no reference, returns the most recent transaction with the given status (default: any failed, pending or reversed one). Includes the failure reason and next steps.', parameters: { type: 'object', properties: { reference: { type: 'string' }, status: { type: 'string', enum: ['failed', 'pending', 'reversed'] } } } },
  { name: 'get_card_status', description: "Status of the verified customer's cards (masked).", parameters: { type: 'object', properties: {} } },
  { name: 'search_knowledge', description: 'Search the business knowledge base (fees, opening hours, limits, how-tos). Use for general questions.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'escalate_to_human', description: 'Hand over to a human agent. Use for fraud, complaints, card blocking, anything that needs changing records or moving money, or whenever you are unsure.', parameters: { type: 'object', properties: { reason: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high'] } }, required: ['reason'] } },
];
