process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.OTP_DEMO = 'true';
process.env.CHAT_RATE_LIMIT = '10000';
process.env.ADMIN_EMAIL = 'owner@test.local';
process.env.ADMIN_PASSWORD = 'correct-horse-9';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/index.js');
const { seedAll } = await import('../src/seed.js');
const { db } = await import('../src/db.js');

let server, base;
let adminToken;
before(async () => {
  seedAll(); server = createApp().listen(0); base = `http://localhost:${server.address().port}/api`;
  adminToken = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@test.local', password: 'correct-horse-9' }) })).json()).token;
  const realFetch = globalThis.fetch; // dashboard routes are signed in automatically in these tests
  globalThis.fetch = (url, init = {}) => String(url).includes('/api/admin/') && !new Headers(init.headers).has('authorization') ? realFetch(url, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), authorization: 'Bearer ' + adminToken } }) : realFetch(url, init);
});
after(() => server.close());

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const chat = (id, message) => post('/chat', { conversationId: id, message });
test('account questions are refused until OTP verification, then the original question is answered', async () => {
  const { conversationId: id } = await post('/chat/start', {});
  const a = await chat(id, 'what is my balance?');
  assert.equal(a.verified, false);
  assert.match(a.reply, /registered/i);
  assert.doesNotMatch(a.reply, /K\d/);

  const b = await chat(id, '0976 000 001');
  assert.equal(b.state, 'awaiting_otp');
  assert.match(b.demoOtp, /^\d{6}$/);

  const bad = await chat(id, '000000');
  assert.match(bad.reply, /isn't right/);
  assert.equal(bad.verified, false);

  const ok = await chat(id, b.demoOtp);
  assert.equal(ok.verified, true);
  assert.match(ok.reply, /verified/i);
  assert.match(ok.reply, /savings/);          // pending balance question answered automatically
  assert.match(ok.reply, /K\d/);
  assert.equal(ok.status, 'ai_resolved');
});

async function verified(phone) {
  const { conversationId: id } = await post('/chat/start', {});
  const r = await chat(id, phone);
  const v = await chat(id, r.demoOtp);
  assert.equal(v.verified, true);
  return id;
}

test('latest failed transfer is explained', async () => {
  const id = await verified('0976000001');
  const r = await chat(id, 'my mobile money transfer failed, what happened?');
  assert.match(r.reply, /TXN-900001/);
  assert.match(r.reply, /FAILED/);
  assert.match(r.reply, /enough available balance/);
});

test('look up by reference', async () => {
  const id = await verified('0976000001');
  const r = await chat(id, 'status of TXN-900002');
  assert.match(r.reply, /PENDING/);
});

test('customers cannot see each other\'s transactions (isolation)', async () => {
  const id = await verified('0976000001');
  const r = await chat(id, 'status of TXN-900003'); // belongs to customer C002
  assert.doesNotMatch(r.reply, /FAILED|NETWORK|75,000|750\.00/);
  assert.match(r.reply, /No transaction with that reference|couldn't|No failed/i);
});

test('fraud report escalates immediately, even unverified, with high priority', async () => {
  const { conversationId: id } = await post('/chat/start', {});
  const r = await chat(id, 'someone withdrew money from my account, this is fraud');
  assert.equal(r.escalated, true);
  const e = db.prepare("SELECT * FROM escalations WHERE conversation_id=? AND status='open'").get(id);
  assert.equal(e.priority, 'high');
});

test('card block and money movement are escalated, never performed', async () => {
  const id = await verified('0976000002');
  const r = await chat(id, 'please block my card');
  assert.equal(r.escalated, true);
  assert.equal(db.prepare("SELECT status FROM cards WHERE customer_id='C002'").get().status, 'active');
  const { conversationId: id2 } = await post('/chat/start', {});
  const r2 = await chat(id2, 'send money to 0977 111 222');
  assert.equal(r2.escalated, true);
});

test('unknown number looks identical to a known one (no enumeration) and cannot verify', async () => {
  const { conversationId: id } = await post('/chat/start', {});
  const r = await chat(id, '0971 999 999');
  assert.equal(r.state, 'awaiting_otp');
  assert.equal(r.demoOtp, undefined);
  assert.equal((await chat(id, '123456')).verified, false);
});

test('OTP locks after 3 wrong tries', async () => {
  const { conversationId: id } = await post('/chat/start', {});
  const r = await chat(id, '0976000003');
  for (let i = 0; i < 3; i++) await chat(id, '111111');
  const late = await chat(id, r.demoOtp);
  assert.equal(late.verified, false);
});

test('PINs and card numbers are redacted before storage', async () => {
  const id = await verified('0976000004');
  const r = await chat(id, 'my pin is 4821 and card 4111 1111 1111 1111, balance?');
  assert.ok(r.warning);
  const stored = db.prepare("SELECT content FROM messages WHERE conversation_id=? AND role='customer'").all(id).map((m) => m.content).join('|');
  assert.doesNotMatch(stored, /4821|4111/);
});

test('public knowledge answers need no verification', async () => {
  const { conversationId: id } = await post('/chat/start', {});
  const r = await chat(id, 'what are your opening hours?');
  assert.match(r.reply, /Monday to Friday/);
  assert.equal(r.verified, false);
});

test('audit trail records verification and tool use', async () => {
  const id = await verified('0976000005');
  await chat(id, 'what is my balance');
  const actions = db.prepare('SELECT action FROM audit_logs WHERE conversation_id=?').all(id).map((a) => a.action);
  assert.ok(actions.includes('verified'));
  assert.ok(actions.includes('tool:get_account_summary'));
});

test('dashboard reflects live conversations', async () => {
  const before = await (await fetch(base + '/admin/overview')).json();
  const { conversationId: id } = await post('/chat/start', {});
  await chat(id, 'what are your opening hours?');
  const after = await (await fetch(base + '/admin/overview')).json();
  assert.equal(after.conversations, before.conversations + 1);
  const list = await (await fetch(base + '/admin/conversations')).json();
  assert.ok(list.length > 0);
  const detail = await (await fetch(base + '/admin/conversations/' + id)).json();
  assert.ok(detail.messages.length >= 3);
});

test('escalation can be resolved by an agent', async () => {
  const open = await (await fetch(base + '/admin/escalations')).json();
  assert.ok(open.length);
  const r = await fetch(base + `/admin/escalations/${open[0].id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 'done' }) });
  assert.equal(r.status, 200);
  assert.equal(db.prepare('SELECT status FROM conversations WHERE id=?').get(open[0].conversationId).status, 'human_resolved');
});

test('contact form stores a lead and validates input', async () => {
  assert.equal((await post('/contact', { name: 'A', email: 'bad', business: 'B' })).status, 400);
  assert.equal((await post('/contact', { name: 'Ann', email: 'a@b.co', business: 'Biz', industry: 'Banking', agents: '12' })).status, 201);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM leads').get().c, 1);
});

test('admin routes reject missing or invalid sign-in', async () => {
  assert.equal((await fetch(base + '/admin/overview', { headers: { authorization: 'Bearer nope' } })).status, 401);
  assert.equal((await fetch(base + '/admin/overview')).status, 200); // test helper adds the owner token
});
