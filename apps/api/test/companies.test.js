process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.CHAT_RATE_LIMIT = '10000';
process.env.SIGNUP_RATE_LIMIT = '1000';
process.env.LOGIN_RATE_LIMIT = '1000';
delete process.env.META_API_KEY;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const { createApp } = await import('../src/index.js');
const { seedAll } = await import('../src/seed.js');
const { db } = await import('../src/db.js');

let server, base, shop, shopPort;
const seen = [];
before(async () => {
  seedAll();
  server = createApp().listen(0); base = `http://localhost:${server.address().port}/api`;
  shop = http.createServer((req, res) => {
    seen.push({ url: req.url, key: req.headers['x-shop-key'] });
    if (req.url === '/orders/1234') return res.end(JSON.stringify({ status: 'shipped', eta: '2026-11-05', internal_note: 'VIP, refund approved', customer: { email: 'x@y.z' } }));
    res.statusCode = 404; res.end('{}');
  }).listen(0);
  shopPort = shop.address().port;
});
after(() => { server.close(); shop.close(); });

async function call(method, path, body, token) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  return Array.isArray(data) ? data : { status: r.status, ...data };
}
let n = 0;
async function signup(company) {
  const email = `owner${++n}@${company.toLowerCase().replace(/\W/g, '')}.test`;
  const r = await call('POST', '/auth/signup', { company, name: 'Owner ' + n, email, password: 'password123' });
  assert.equal(r.status, 201, JSON.stringify(r));
  const w = await call('GET', '/admin/widget', null, r.token);
  return { token: r.token, user: r.user, key: w.key, email };
}
const publish = (a) => call('PUT', '/admin/widget', { enabled: true, name: a.user.company.name, color: '#155EEF', allowedDomains: '' }, a.token);
const chatStart = (key, token) => call('POST', '/chat/start', key ? { key } : {}, token);
const chat = (id, message) => call('POST', '/chat', { conversationId: id, message });

let A, B;
before(async () => { A = await signup('Alpha Shop'); B = await signup('Beta Telecom'); });

test('signup creates a separate company, checks input, and refuses a duplicate email', async () => {
  assert.notEqual(A.user.companyId, B.user.companyId);
  assert.notEqual(A.key, B.key);
  assert.equal(A.user.company.mode, 'standard');
  assert.equal((await call('POST', '/auth/signup', { company: 'X', name: 'a', email: A.email, password: 'password123' })).status, 400);
  assert.equal((await call('POST', '/auth/signup', { company: 'Alpha Again', name: 'a', email: A.email, password: 'password123' })).status, 409);
  assert.equal((await call('POST', '/auth/signup', { company: 'Gamma Co', name: 'a', email: 'g@gamma.test', password: 'short' })).status, 400);
  const login = await call('POST', '/auth/login', { email: A.email, password: 'password123' });
  assert.equal(login.user.companyId, A.user.companyId);
});

test('chat needs a published widget key; owners can preview their own company before publishing', async () => {
  assert.equal((await chatStart(A.key)).status, 404);
  const preview = await chatStart(null, A.token);
  assert.equal(preview.status, 201);
  assert.match(preview.greeting, /Alpha Shop/);
  assert.equal(db.prepare('SELECT company_id FROM conversations WHERE id=?').get(preview.conversationId).company_id, A.user.companyId);
  await publish(A); await publish(B);
  assert.equal((await chatStart(A.key)).status, 201);
  assert.equal((await chatStart('wk_nonsense')).status, 404);
});

test('each company answers only from its own knowledge base', async () => {
  await call('POST', '/admin/knowledge', { title: 'Refund policy', body: 'Alpha refunds within 14 days with a receipt.', tags: 'refund refunds return receipt' }, A.token);
  await call('POST', '/admin/knowledge', { title: 'Data bundles', body: 'Beta bundles start at K10 for 1GB.', tags: 'bundle bundles data internet' }, B.token);
  const ca = (await chatStart(A.key)).conversationId, cb = (await chatStart(B.key)).conversationId;
  assert.match((await chat(ca, 'What is your refund policy?')).reply, /14 days/);
  assert.doesNotMatch((await chat(cb, 'What is your refund policy?')).reply, /14 days/);
  assert.match((await chat(cb, 'how much are data bundles')).reply, /K10/);
  assert.doesNotMatch((await chat(ca, 'how much are data bundles')).reply, /K10/);
});

test('standard companies never run the bank or OTP flow', async () => {
  const id = (await chatStart(A.key)).conversationId;
  const r = await chat(id, 'What is my balance? my number is 0976 000 001');
  assert.equal(r.demoOtp, undefined);
  assert.equal(r.verified, false);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM otps WHERE conversation_id=?').get(id).c, 0);
});

test('a company cannot see or change another company\'s data', async () => {
  const kbA = (await call('GET', '/admin/knowledge', null, A.token));
  const kbB = (await call('GET', '/admin/knowledge', null, B.token));
  assert.ok(kbA.every((k) => !/Beta/.test(k.body)) && kbB.every((k) => !/Alpha/.test(k.body)));
  const aId = kbA[0].id;
  assert.equal((await call('PUT', `/admin/knowledge/${aId}`, { title: 'hacked', body: 'hacked' }, B.token)).status, 404);
  assert.equal((await call('DELETE', `/admin/knowledge/${aId}`, null, B.token)).status, 404);
  // conversations and escalations
  const ca = (await chatStart(A.key)).conversationId;
  await chat(ca, 'I want to speak to a human please');
  const escA = await call('GET', '/admin/escalations', null, A.token);
  assert.ok(escA.length >= 1);
  assert.equal((await call('GET', '/admin/escalations', null, B.token)).length, 0);
  assert.equal((await call('PATCH', `/admin/escalations/${escA[0].id}`, { note: 'x' }, B.token)).status, 404);
  assert.equal((await call('GET', `/admin/conversations/${ca}`, null, B.token)).status, 404);
  assert.equal((await call('GET', `/admin/conversations/${ca}`, null, A.token)).id, ca);
  assert.ok((await call('GET', '/admin/conversations', null, B.token)).every((c) => c.id !== ca));
  const ov = await call('GET', '/admin/overview', null, B.token);
  assert.equal(ov.openEscalations, 0);
  // platform-only data
  assert.equal((await call('GET', '/admin/leads', null, B.token)).status, 403);
  assert.equal((await call('POST', '/admin/reset-demo', null, B.token)).status, 403);
});

test('original company (1) keeps its data and demo flow after the migration', async () => {
  assert.ok(db.prepare('SELECT COUNT(*) c FROM knowledge WHERE company_id=1').get().c >= 8);
  const s = await chatStart(null);
  const id = s.conversationId;
  const r = await chat(id, '+260976000001');
  assert.ok(r.demoOtp);
  assert.equal((await chat(id, r.demoOtp)).verified, true);
});

const goodLookup = () => ({ name: 'order_status', description: 'Look up the status of an order by its order number.', urlTemplate: `http://127.0.0.1:${shopPort}/orders/{order_id}`, params: [{ name: 'order_id', description: 'The order number' }], authHeader: 'x-shop-key', authSecret: 'super-secret-123', fields: 'status,eta' });

test('lookups: unsafe URLs are refused when saving', async () => {
  const bad = async (patch) => (await call('POST', '/admin/connectors', { ...goodLookup(), ...patch }, A.token)).status;
  assert.equal(await bad({}), 400, 'plain http / 127.0.0.1 not allowed by default');
  assert.equal(await bad({ urlTemplate: 'https://localhost/x/{order_id}' }), 400);
  assert.equal(await bad({ urlTemplate: 'https://10.0.0.5/x/{order_id}' }), 400);
  assert.equal(await bad({ urlTemplate: 'https://169.254.169.254/latest/{order_id}' }), 400);
  assert.equal(await bad({ urlTemplate: 'https://{order_id}.evil.com/x' }), 400);
  assert.equal(await bad({ urlTemplate: 'https://user:pw@shop.example.com/{order_id}' }), 400);
  assert.equal(await bad({ urlTemplate: 'https://shop.example.com/{nope}' }), 400);
  assert.equal(await bad({ urlTemplate: 'https://shop.example.com/{order_id}', fields: '' }), 400, 'must allow-list fields');
  assert.equal(await bad({ urlTemplate: 'https://shop.example.com/{order_id}', authHeader: 'Host' }), 400);
});

test('lookups: secret is encrypted, never returned, only allow-listed fields come back', async () => {
  process.env.ALLOW_PRIVATE_CONNECTORS = 'true';
  try {
    const made = await call('POST', '/admin/connectors', goodLookup(), A.token);
    assert.equal(made.status, 200, JSON.stringify(made));
    const list = await call('GET', '/admin/connectors', null, A.token);
    assert.equal(JSON.stringify(list).includes('super-secret'), false);
    assert.equal(list[0].hasSecret, true);
    assert.equal(db.prepare('SELECT auth_secret_enc e FROM connectors').get().e.includes('super-secret'), false);
    const t = await call('POST', `/admin/connectors/${made.id}/test`, { args: { order_id: '1234' } }, A.token);
    assert.deepEqual(t.data, { status: 'shipped', eta: '2026-11-05' });
    assert.equal(seen.at(-1).key, 'super-secret-123');
    assert.equal(JSON.stringify(t).includes('internal_note'), false);
    assert.equal((await call('POST', `/admin/connectors/${made.id}/test`, { args: { order_id: '999' } }, A.token)).found, false);
    // B cannot see, test or delete A's lookup
    assert.deepEqual(await call('GET', '/admin/connectors', null, B.token), []);
    assert.equal((await call('POST', `/admin/connectors/${made.id}/test`, { args: { order_id: '1234' } }, B.token)).status, 404);
    assert.equal((await call('DELETE', `/admin/connectors/${made.id}`, null, B.token)).status, 404);
  } finally { delete process.env.ALLOW_PRIVATE_CONNECTORS; }
});

test('lookups: the address is re-checked at call time, so a private address is refused even if saved earlier', async () => {
  const before = seen.length;
  const c = db.prepare('SELECT id FROM connectors').get();
  const r = await call('POST', `/admin/connectors/${c.id}/test`, { args: { order_id: '1234' } }, A.token);
  assert.ok(r.error);
  assert.equal(seen.length, before, 'the request never reached the private address');
});

test('the AI can use a company lookup, sees only allowed fields, and other companies cannot use it', async () => {
  process.env.ALLOW_PRIVATE_CONNECTORS = 'true'; process.env.META_API_KEY = 'test-meta-key';
  const real = globalThis.fetch; const bodies = [];
  const callTool = (name, args) => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] }));
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.meta.ai/')) return real(url, init);
    const body = JSON.parse(init.body); bodies.push(body);
    const last = body.messages.at(-1);
    if (last.role === 'tool') return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Your order has shipped.' } }] }));
    return callTool('lookup_order_status', { order_id: '1234' });
  };
  try {
    const ca = (await chatStart(A.key)).conversationId;
    const r = await chat(ca, 'where is order 1234?');
    assert.equal(r.reply, 'Your order has shipped.');
    assert.ok(bodies[0].tools.some((t) => t.function.name === 'lookup_order_status'));
    const toolMsg = bodies[1].messages.at(-1).content;
    assert.match(toolMsg, /shipped/); assert.doesNotMatch(toolMsg, /internal_note|VIP/);
    assert.match(bodies[0].messages[0].content, /Alpha Shop/);
    // Company B's model is not offered that tool, and cannot run it even if it asks
    bodies.length = 0;
    const cb = (await chatStart(B.key)).conversationId;
    await chat(cb, 'where is order 1234?');
    assert.ok(!bodies[0].tools.some((t) => t.function.name === 'lookup_order_status'));
    assert.match(bodies[1].messages.at(-1).content, /Unknown tool/);
  } finally { globalThis.fetch = real; delete process.env.ALLOW_PRIVATE_CONNECTORS; delete process.env.META_API_KEY; }
});
