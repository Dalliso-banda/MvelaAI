process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.OTP_DEMO = 'true';
process.env.CHAT_RATE_LIMIT = '10000';
delete process.env.META_API_KEY;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/index.js');
const { seedAll } = await import('../src/seed.js');
const { db } = await import('../src/db.js');
const { multiAgentOn } = await import('../src/llm.js');

let server, base;
before(() => { seedAll(); server = createApp().listen(0); base = `http://localhost:${server.address().port}/api`; });
after(() => server.close());

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const chat = (id, message) => post('/chat', { conversationId: id, message });
async function verified(phone) {
  const { conversationId: id } = await post('/chat/start', {});
  const r = await chat(id, phone);
  assert.equal((await chat(id, r.demoOtp)).verified, true);
  return id;
}
const reply = (content, extra = {}) => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content, ...extra } }] }));
const toolCall = () => reply(null, { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_account_summary', arguments: '{}' } }] });

// Fake Muse. `script` decides what each agent says. Calls are recorded by agent.
function fakeMuse({ triage, specialist, reviewer }) {
  const real = globalThis.fetch; const calls = { triage: [], specialist: [], reviewer: [] };
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.meta.ai/v1/')) return real(url, init);
    const body = JSON.parse(init.body);
    const sys = body.messages[0].content;
    const who = sys.startsWith('You triage') ? 'triage' : sys.startsWith('You are a strict reviewer') ? 'reviewer' : 'specialist';
    calls[who].push(body);
    const fn = { triage, specialist, reviewer }[who];
    return fn(calls[who].length, body);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const trace = (id) => JSON.parse(db.prepare("SELECT detail FROM audit_logs WHERE conversation_id=? AND action='agents'").get(id).detail).trace;

test('multi-agent is off by default in tests and on in production', () => {
  assert.equal(multiAgentOn(), false);
  process.env.MULTI_AGENT = 'true'; assert.equal(multiAgentOn(), true);
  process.env.NODE_ENV = 'production'; delete process.env.MULTI_AGENT; assert.equal(multiAgentOn(), true);
  process.env.MULTI_AGENT = 'false'; assert.equal(multiAgentOn(), false);
  process.env.NODE_ENV = 'test'; delete process.env.MULTI_AGENT;
});

test('triage, specialist with tools, and reviewer all run, in order, and the specialist gets the triage hint', async () => {
  const id = await verified('0976000006');
  process.env.META_API_KEY = 'k'; process.env.MULTI_AGENT = 'true';
  const m = fakeMuse({
    triage: () => reply('{"intent":"account","urgency":"normal"}'),
    specialist: (n) => (n === 1 ? toolCall() : reply('You have two accounts.')),
    reviewer: () => reply('{"verdict":"ok","issues":[]}'),
  });
  try {
    const r = await chat(id, 'how much money do i have');
    assert.equal(r.reply, 'You have two accounts.');
    assert.equal(m.calls.triage.length, 1);
    assert.equal(m.calls.specialist.length, 2);
    assert.equal(m.calls.reviewer.length, 1);
    assert.match(m.calls.specialist[0].messages[0].content, /own account or order/);
    assert.equal(m.calls.triage[0].tools, undefined); // helpers never get tools
    assert.equal(m.calls.reviewer[0].tools, undefined);
    assert.match(m.calls.reviewer[0].messages[1].content, /two accounts|accounts/i); // evidence reached the reviewer
    assert.deepEqual(trace(id), ['triage:account/normal', 'specialist', 'reviewer:ok']);
  } finally { m.restore(); delete process.env.META_API_KEY; delete process.env.MULTI_AGENT; }
});

test('reviewer can rewrite an unsupported draft', async () => {
  const id = await verified('0976000007');
  process.env.META_API_KEY = 'k'; process.env.MULTI_AGENT = 'true';
  const m = fakeMuse({
    triage: () => reply('{"intent":"account","urgency":"low"}'),
    specialist: (n) => (n === 1 ? toolCall() : reply('Your balance is K999,999.')),
    reviewer: () => reply('{"verdict":"revise","issues":["amount not in evidence"],"revised":"I can see your accounts, here are the balances from the system."}'),
  });
  try {
    const r = await chat(id, 'balance please');
    assert.equal(r.reply, 'I can see your accounts, here are the balances from the system.');
    assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE conversation_id=? AND action='review'").get(id));
  } finally { m.restore(); delete process.env.META_API_KEY; delete process.env.MULTI_AGENT; }
});

test('reviewer can block a reply: customer gets the safe message and a human is flagged', async () => {
  const id = await verified('0976000008');
  process.env.META_API_KEY = 'k'; process.env.MULTI_AGENT = 'true';
  const m = fakeMuse({
    triage: () => reply('{"intent":"other","urgency":"normal"}'),
    specialist: () => reply('Sure, your PIN is 1234, just confirm it for me in 3 days.'),
    reviewer: () => reply('```json\n{"verdict":"block","issues":["asks for PIN"]}\n```'),
  });
  try {
    const r = await chat(id, 'hello there, can you help with 2 things');
    assert.match(r.reply, /passed it to a human/);
    assert.doesNotMatch(r.reply, /1234/);
    assert.ok(db.prepare('SELECT 1 FROM escalations WHERE conversation_id=?').get(id));
  } finally { m.restore(); delete process.env.META_API_KEY; delete process.env.MULTI_AGENT; }
});

test('if triage and reviewer fail, the customer still gets the specialist answer', async () => {
  const id = await verified('0976000001');
  process.env.META_API_KEY = 'k'; process.env.MULTI_AGENT = 'true';
  const m = fakeMuse({
    triage: () => new Response('boom', { status: 500 }),
    specialist: (n) => (n === 1 ? toolCall() : reply('You have two accounts.')),
    reviewer: () => reply('not json at all'),
  });
  try {
    const r = await chat(id, 'how much money do i have');
    assert.equal(r.reply, 'You have two accounts.');
    assert.deepEqual(trace(id), ['triage:failed', 'specialist', 'reviewer:ok']);
  } finally { m.restore(); delete process.env.META_API_KEY; delete process.env.MULTI_AGENT; }
});

test('MULTI_AGENT=false makes exactly one model call for a plain reply', async () => {
  const id = await verified('0976000002');
  process.env.META_API_KEY = 'k'; process.env.MULTI_AGENT = 'false';
  const m = fakeMuse({ triage: () => { throw new Error('no'); }, specialist: () => reply('Hello!'), reviewer: () => { throw new Error('no'); } });
  try {
    await chat(id, 'hi');
    assert.equal(m.calls.triage.length + m.calls.reviewer.length, 0);
    assert.equal(m.calls.specialist.length, 1);
  } finally { m.restore(); delete process.env.META_API_KEY; delete process.env.MULTI_AGENT; }
});
