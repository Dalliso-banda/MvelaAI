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
const { llmProvider } = await import('../src/llm.js');

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

test('provider: Muse when META_API_KEY is set, otherwise the rules agent; no other provider', () => {
  assert.equal(llmProvider(), null);
  process.env.LLM_PROVIDER = 'other'; assert.equal(llmProvider(), null); // no other provider exists
  process.env.META_API_KEY = 'm'; assert.equal(llmProvider(), 'muse');
  delete process.env.LLM_PROVIDER; delete process.env.META_API_KEY;
});

test('Muse tool loop: OpenAI-format tool call is executed for the verified customer only, result fed back', async () => {
  const id = await verified('0976000006');
  process.env.META_API_KEY = 'test-meta-key';
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.meta.ai/v1/')) return real(url, init);
    const body = JSON.parse(init.body);
    seen.push({ url: String(url), auth: init.headers.authorization, body });
    if (seen.length === 1) {
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_account_summary', arguments: '{"customerId":"C001"}' } }] } }] }));
    }
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'You have two accounts.' } }] }));
  };
  try {
    const r = await chat(id, 'how much money do i have');
    assert.equal(r.reply, 'You have two accounts.');
    assert.equal(seen[0].url, 'https://api.meta.ai/v1/chat/completions');
    assert.equal(seen[0].auth, 'Bearer test-meta-key');
    assert.equal(seen[0].body.model, 'muse-spark-1.1');
    assert.ok(seen[0].body.tools.length >= 5 && seen[0].body.tools[0].type === 'function');
    assert.equal(seen[0].body.messages[0].role, 'system');
    const toolMsg = seen[1].body.messages.at(-1);
    assert.equal(toolMsg.role, 'tool');
    assert.equal(toolMsg.tool_call_id, 'call_1');
    const result = JSON.parse(toolMsg.content);
    const own = db.prepare("SELECT number_masked FROM accounts WHERE customer_id='C006' AND type='savings'").get().number_masked;
    assert.ok(result.accounts.some((a) => a.account === own)); // C006's data, not the C001 the model asked for
    assert.ok(!result.accounts.some((a) => a.account === db.prepare("SELECT number_masked FROM accounts WHERE customer_id='C001' AND type='savings'").get().number_masked));
  } finally { globalThis.fetch = real; delete process.env.META_API_KEY; }
});

test('Muse outage falls back to the rules agent', async () => {
  const id = await verified('0976000007');
  process.env.META_API_KEY = 'test-meta-key';
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes('api.meta.ai') ? new Response('overloaded', { status: 503 }) : real(url, init);
  try {
    const r = await chat(id, 'what is my balance');
    assert.match(r.reply, /K\d/);
    assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE conversation_id=? AND action='llm_error_fallback'").get(id));
  } finally { globalThis.fetch = real; delete process.env.META_API_KEY; }
});
