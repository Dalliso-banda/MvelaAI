process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.CHAT_RATE_LIMIT = '10000';
process.env.MOCKBANK_API_KEY = 'test-key';
delete process.env.GEMINI_API_KEY;
delete process.env.META_API_KEY;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/index.js');
const { createBank } = await import('../../mockbank/server.js');
const { seedAll } = await import('../src/seed.js');
const { db } = await import('../src/db.js');
const { submit, queueStats } = await import('../src/queue.js');
const { deliverOtp } = await import('../src/delivery.js');

let api, bank, base;
before(() => {
  seedAll();
  api = createApp().listen(0); base = `http://localhost:${api.address().port}/api`;
  bank = createBank().listen(0);
});
after(() => { api.close(); bank.close(); });

const useBank = (on = true) => {
  if (on) { process.env.BANK_MODE = 'http'; process.env.BANK_API_URL = `http://localhost:${bank.address().port}`; process.env.BANK_API_KEY = 'test-key'; }
  else { delete process.env.BANK_MODE; }
};
const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const chat = (id, message) => post('/chat', { conversationId: id, message });
const start = async () => (await post('/chat/start', {})).conversationId;

test('http mode: verification and account data come from the outside bank API', async () => {
  useBank();
  try {
    const id = await start();
    const r = await chat(id, '+260976000001');
    assert.match(r.reply, /registered with us/);
    assert.ok(r.demoOtp);
    assert.equal((await chat(id, r.demoOtp)).verified, true);
    const bal = await chat(id, 'What is my balance?');
    assert.match(bal.reply, /4,210\.50/); // balance from the mock bank, not the seed data
    const tx = await chat(id, 'my transfer failed');
    assert.match(tx.reply, /TXN-B00001/);
    assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE action LIKE 'job:bank.%'").get());
  } finally { useBank(false); }
});

test('http mode: unknown and closed customers get the same reply and no code', async () => {
  useBank();
  try {
    const known = await chat(await start(), '+260976000002');
    for (const phone of ['+260976999999', '+260976000003']) {
      const r = await chat(await start(), phone);
      assert.equal(r.demoOtp, undefined);
      assert.equal(r.reply.replace(/\+260\S+|\*+\d+/g, ''), known.reply.replace(/\+260\S+|\*+\d+/g, '').replace(/\n\nDemo mode.*$/s, ''));
    }
  } finally { useBank(false); }
});

test('http mode: bank down means a clear message, never a made-up answer', async () => {
  useBank();
  process.env.BANK_API_URL = 'http://localhost:1'; process.env.BANK_TIMEOUT_MS = '300';
  try {
    const r = await chat(await start(), '+260976000001');
    assert.match(r.reply, /can't reach our verification service/);
    assert.equal(r.demoOtp, undefined);
  } finally { useBank(false); delete process.env.BANK_TIMEOUT_MS; }
});

test('http mode: wrong API key is not retried and not treated as "unknown customer"', async () => {
  useBank(); process.env.BANK_API_KEY = 'wrong';
  try {
    const r = await chat(await start(), '+260976000001');
    assert.match(r.reply, /can't reach our verification service/);
  } finally { useBank(false); }
});

test('demo mode still works with no bank configured', async () => {
  const id = await start();
  const r = await chat(id, '+260976000001');
  assert.ok(r.demoOtp);
  assert.equal((await chat(id, r.demoOtp)).verified, true);
});

test('queue: retries transient failures, not permanent ones', async () => {
  let n = 0;
  const v = await submit('t.flaky', async () => { if (++n < 2) { const e = new Error('blip'); e.transient = true; throw e; } return 'ok'; });
  assert.equal(v, 'ok'); assert.equal(n, 2);
  let m = 0;
  await assert.rejects(submit('t.perm', async () => { m++; const e = new Error('bad'); e.transient = false; throw e; }));
  assert.equal(m, 1);
});

test('queue: respects concurrency and runs higher priority first', async () => {
  const order = [];
  const slow = (tag) => async () => { order.push(tag); await new Promise((r) => setTimeout(r, 20)); };
  const jobs = [];
  for (let i = 0; i < 4; i++) jobs.push(submit('t.fill', slow('fill'), { priority: 5 }));
  jobs.push(submit('t.low', slow('low'), { priority: 9 }), submit('t.high', slow('high'), { priority: 1 }));
  await Promise.all(jobs);
  assert.ok(order.indexOf('high') < order.indexOf('low'));
  assert.deepEqual(queueStats(), { running: 0, waiting: 0 });
});

test('queue: a hung job times out', async () => {
  process.env.JOB_TIMEOUT_MS = '100';
  try { await assert.rejects(submit('t.hang', () => new Promise(() => {}), { retry: false }), /timed out/i); }
  finally { delete process.env.JOB_TIMEOUT_MS; }
});

test('delivery: email and SMS go to the providers; failure is reported, never thrown', async () => {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('resend')) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify({ SMSMessageData: { Recipients: [{ statusCode: 101, status: 'Success' }] } }), { status: 201 });
  };
  Object.assign(process.env, { OTP_CHANNEL: 'email,sms', RESEND_API_KEY: 'rk', AT_API_KEY: 'ak', AT_USERNAME: 'sandbox' });
  try {
    const ok = await deliverOtp({ customer: { phone: '+260976000001', email: 'a@real.com' }, code: '123456', conversationId: null });
    assert.deepEqual(ok.sent, ['email', 'sms']); assert.equal(ok.demoOtp, undefined);
    assert.match(calls[0].init.headers.authorization, /Bearer rk/);
    assert.equal(calls[1].init.headers.apiKey, 'ak');
    assert.match(String(calls[1].init.body), /123456/);
    globalThis.fetch = async () => new Response('no', { status: 400 });
    const bad = await deliverOtp({ customer: { phone: '+260976000001', email: 'a@real.com' }, code: '123456', conversationId: null });
    assert.equal(bad.sent.length, 0); assert.equal(bad.failed.length, 2);
  } finally {
    globalThis.fetch = real;
    for (const k of ['OTP_CHANNEL', 'RESEND_API_KEY', 'AT_API_KEY', 'AT_USERNAME']) delete process.env[k];
  }
});
