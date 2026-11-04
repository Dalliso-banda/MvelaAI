process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.CHAT_RATE_LIMIT = '10000';
process.env.SIGNUP_RATE_LIMIT = '1000';
process.env.ALLOW_PRIVATE_CONNECTORS = 'true'; // lets the test reach the shop on localhost; real servers need https
delete process.env.META_API_KEY;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/index.js');
const { seedAll } = await import('../src/seed.js');
const { createShop } = await import('../../demoshop/server.js');

let server, base, shop, shopUrl;
before(async () => {
  seedAll();
  server = createApp().listen(0); base = `http://localhost:${server.address().port}/api`;
  shop = createShop({ apiKey: 'test-shop-key' });
  await new Promise((r) => shop.listen(0, '127.0.0.1', r));
  shopUrl = `http://127.0.0.1:${shop.address().port}`;
});
after(() => { server.close(); shop.close(); delete process.env.ALLOW_PRIVATE_CONNECTORS; });

async function call(method, path, body, token) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  return Array.isArray(data) ? Object.assign(data, { status: r.status }) : { status: r.status, ...data };
}

test('the demo shop: orders and stock need its key, hide nothing from its own API, and 404 politely', async () => {
  const get = (p, h) => fetch(shopUrl + p, { headers: h }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  assert.equal((await get('/api/orders/TZ-1001')).status, 401);
  const o = await get('/api/orders/tz-1001', { 'x-shop-key': 'test-shop-key' });
  assert.equal(o.status, 200); assert.equal(o.body.status, 'shipped'); assert.ok(o.body.internal_note);
  assert.equal((await get('/api/orders/NOPE', { 'x-shop-key': 'test-shop-key' })).status, 404);
  assert.equal((await get('/api/stock/jackets', { 'x-shop-key': 'test-shop-key' })).body.in_stock, true);
  assert.equal((await fetch(shopUrl + '/', { method: 'POST' })).status, 405);
});

test('a company connects the shop as Lookups, and the AI answers from it without leaking private fields', async () => {
  const signup = await call('POST', '/auth/signup', { company: 'Chalo Threads', name: 'Owner', email: 'o@chalo.test', password: 'password123' });
  assert.equal(signup.status, 201);
  const T = signup.token;
  const w = await call('GET', '/admin/widget', null, T);
  await call('PUT', '/admin/widget', { enabled: true, name: 'Chalo Threads', color: '#C2410C', allowedDomains: '' }, T);

  const order = await call('POST', '/admin/connectors', {
    name: 'order_status', description: 'Look up an order by its order number, like TZ-1001.', urlTemplate: `${shopUrl}/api/orders/{order_id}`,
    params: [{ name: 'order_id', description: 'The order number' }], authHeader: 'x-shop-key', authSecret: 'test-shop-key',
    fields: 'order_id, status, estimated_delivery, carrier, tracking_number, delay_reason, refund_status, pickup_location, items',
  }, T);
  assert.ok(order.id, JSON.stringify(order));
  const stock = await call('POST', '/admin/connectors', {
    name: 'stock_check', description: 'Check if an item (jacket, coat, sneakers, shirt) is in stock.', urlTemplate: `${shopUrl}/api/stock/{item}`,
    params: [{ name: 'item', description: 'The item name' }], authHeader: 'x-shop-key', authSecret: 'test-shop-key', fields: 'item, in_stock, sizes, price_zmw, restock',
  }, T);
  assert.ok(stock.id, JSON.stringify(stock));

  // The dashboard Test button shows exactly what the AI sees: private fields are not there.
  const t = await call('POST', `/admin/connectors/${order.id}/test`, { args: { order_id: 'TZ-1004' } }, T);
  assert.equal(t.found, true);
  assert.equal(t.data.status, 'delayed');
  assert.match(t.data.delay_reason, /courier/);
  assert.equal(t.data.internal_note, undefined);
  assert.equal(t.data.customer_email, undefined);
  assert.equal((await call('POST', `/admin/connectors/${order.id}/test`, { args: { order_id: 'TZ-9999' } }, T)).found, false);
  assert.equal((await call('POST', `/admin/connectors/${stock.id}/test`, { args: { item: 'sneakers' } }, T)).data.in_stock, false);

  // A chat: the model calls the lookup, gets only allowed fields, and answers.
  process.env.META_API_KEY = 'k';
  const real = globalThis.fetch; const bodies = [];
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.meta.ai/v1/')) return real(url, init);
    const body = JSON.parse(init.body); bodies.push(body);
    if (body.messages.at(-1).role === 'tool') return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'TZ-1004 is delayed because the courier is short of vehicles. It should arrive in about five days.' } }] }));
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'lookup_order_status', arguments: '{"order_id":"TZ-1004"}' } }] } }] }));
  };
  try {
    const start = await call('POST', '/chat/start', { key: w.key });
    const r = await call('POST', '/chat', { conversationId: start.conversationId, message: 'why is TZ-1004 late?' });
    assert.match(r.reply, /courier/);
    const names = bodies[0].tools.map((x) => x.function.name);
    assert.ok(names.includes('lookup_order_status') && names.includes('lookup_stock_check'));
    const toolResult = bodies[1].messages.at(-1).content;
    assert.match(toolResult, /delayed/);
    assert.doesNotMatch(toolResult, /internal_note|natasha|chased/);
  } finally { globalThis.fetch = real; delete process.env.META_API_KEY; }
});
