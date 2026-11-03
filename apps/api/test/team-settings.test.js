process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.CHAT_RATE_LIMIT = '10000';
process.env.SIGNUP_RATE_LIMIT = '1000';
process.env.LOGIN_RATE_LIMIT = '1000';
delete process.env.META_API_KEY;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/index.js');
const { seedAll } = await import('../src/seed.js');

let server, base;
before(() => { seedAll(); server = createApp().listen(0); base = `http://localhost:${server.address().port}/api`; });
after(() => server.close());

async function call(method, path, body, token) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  return Array.isArray(data) ? Object.assign(data, { status: r.status }) : { status: r.status, ...data };
}
let n = 0;
async function signup(company) {
  const email = `owner${++n}@${company.toLowerCase().replace(/\W/g, '')}.test`;
  const r = await call('POST', '/auth/signup', { company, name: 'Owner', email, password: 'password123' });
  return { token: r.token, user: r.user, email };
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).token;

let A, B;
before(async () => { A = await signup('Alpha Shop'); B = await signup('Beta Telecom'); });

test('owner adds an admin and an agent; roles limit what each can do', async () => {
  const adm = await call('POST', '/admin/team', { name: 'Ada Admin', email: 'ada@alpha.test', role: 'admin' }, A.token);
  assert.equal(adm.status, 201); assert.ok(adm.tempPassword && adm.tempPassword.length >= 10);
  const agt = await call('POST', '/admin/team', { name: 'Ayo Agent', email: 'ayo@alpha.test', role: 'agent' }, A.token);
  assert.equal(agt.status, 201);
  A.admin = await login('ada@alpha.test', adm.tempPassword); A.agent = await login('ayo@alpha.test', agt.tempPassword);
  A.agentId = agt.user.id; A.adminId = adm.user.id;
  assert.ok(A.admin && A.agent, 'temporary passwords work');

  // agent: can work conversations and escalations, cannot manage anything else
  assert.equal((await call('GET', '/admin/conversations', null, A.agent)).status, 200);
  assert.equal((await call('GET', '/admin/escalations', null, A.agent)).status, 200);
  assert.equal((await call('GET', '/admin/knowledge', null, A.agent)).status, 200);
  for (const [m, p, b] of [['POST', '/admin/knowledge', { title: 'x', body: 'y' }], ['GET', '/admin/connectors'], ['GET', '/admin/team'], ['GET', '/admin/settings'], ['GET', '/admin/ai-settings'], ['GET', '/admin/widget'], ['PUT', '/admin/widget', { enabled: true }]]) {
    assert.equal((await call(m, p, b, A.agent)).status, 403, `${m} ${p} should be admin only`);
  }
  // admin: manages the company, but can only add agents and cannot change roles
  assert.equal((await call('GET', '/admin/team', null, A.admin)).length, 3);
  assert.equal((await call('POST', '/admin/knowledge', { title: 'FAQ', body: 'We open at 8.' }, A.admin)).status, 201);
  assert.equal((await call('POST', '/admin/team', { name: 'X', email: 'x@alpha.test', role: 'admin' }, A.admin)).status, 403);
  assert.equal((await call('POST', '/admin/team', { name: 'X', email: 'x@alpha.test', role: 'owner' }, A.owner || A.token)).status, 403);
  assert.equal((await call('PATCH', `/admin/team/${A.agentId}`, { role: 'admin' }, A.admin)).status, 403);
});

test('removing a person or resetting a password takes effect at once', async () => {
  const reset = await call('POST', `/admin/team/${A.agentId}/reset-password`, null, A.admin);
  assert.ok(reset.tempPassword);
  assert.equal(await login('ayo@alpha.test', 'whatever-old'), undefined);
  assert.ok(await login('ayo@alpha.test', reset.tempPassword));
  assert.equal((await call('DELETE', `/admin/team/${A.adminId}`, null, A.admin)).status, 400, 'cannot remove yourself');
  assert.equal((await call('DELETE', `/admin/team/${A.user.id}`, null, A.admin)).status, 403, 'cannot remove the owner');
  assert.equal((await call('DELETE', `/admin/team/${A.agentId}`, null, A.admin)).status, 200);
  assert.equal((await call('GET', '/admin/conversations', null, A.agent)).status, 401, 'old token stops working immediately');
});

test('owner can promote and demote; teams are separate between companies', async () => {
  const m = await call('POST', '/admin/team', { name: 'Pat', email: 'pat@alpha.test', role: 'agent' }, A.token);
  assert.equal((await call('PATCH', `/admin/team/${m.user.id}`, { role: 'admin' }, A.token)).status, 200);
  assert.equal((await call('GET', '/admin/team', null, A.token)).find((u) => u.id === m.user.id).role, 'admin');
  // company B cannot see or touch company A's people
  assert.ok((await call('GET', '/admin/team', null, B.token)).every((u) => !/alpha/.test(u.email)));
  assert.equal((await call('DELETE', `/admin/team/${m.user.id}`, null, B.token)).status, 404);
  assert.equal((await call('POST', `/admin/team/${m.user.id}/reset-password`, null, B.token)).status, 404);
  assert.equal((await call('PATCH', `/admin/team/${m.user.id}`, { role: 'agent' }, B.token)).status, 404);
  // an email can only have one account
  assert.equal((await call('POST', '/admin/team', { name: 'Dup', email: 'pat@alpha.test', role: 'agent' }, B.token)).status, 409);
});

test('changing your own password needs the current one', async () => {
  assert.equal((await call('POST', '/admin/account/password', { current: 'wrong', next: 'brandnew123' }, B.token)).status, 403);
  assert.equal((await call('POST', '/admin/account/password', { current: 'password123', next: 'short' }, B.token)).status, 400);
  assert.equal((await call('POST', '/admin/account/password', { current: 'password123', next: 'brandnew123' }, B.token)).status, 200);
  assert.equal(await login(B.email, 'password123'), undefined);
  assert.ok(await login(B.email, 'brandnew123'));
});

test('company settings: name, welcome message and hours-saved assumption are saved per company', async () => {
  const bad = await call('PUT', '/admin/settings', { companyName: 'A', welcome: '', handleMinutes: 5 }, A.token);
  assert.equal(bad.status, 400);
  const ok = await call('PUT', '/admin/settings', { companyName: 'Alpha Hardware', welcome: 'Karibu! How can we help?', handleMinutes: 30 }, A.token);
  assert.equal(ok.companyName, 'Alpha Hardware');
  assert.equal((await call('GET', '/admin/settings', null, B.token)).companyName, 'Beta Telecom', 'other company untouched');
  const ov = await call('GET', '/admin/overview', null, A.token);
  assert.match(ov.hoursSavedBasis, /^30 min/);
  // welcome message used when a chat starts (owner preview before publishing)
  const start = await call('POST', '/chat/start', {}, A.token);
  assert.equal(start.greeting, 'Karibu! How can we help?');
});

test('AI style settings reach the model prompt but cannot replace the rules', async () => {
  const set = await call('PUT', '/admin/ai-settings', { aiName: 'Zuri', tone: 'formal', notes: 'We deliver within Lusaka for K50.' }, A.token);
  assert.equal(set.aiName, 'Zuri');
  assert.equal((await call('PUT', '/admin/ai-settings', { aiName: 'x', tone: 'rude', notes: '' }, A.token)).status, 400);
  assert.equal((await call('PUT', '/admin/ai-settings', { aiName: 'x', tone: 'formal', notes: 'a'.repeat(1001) }, A.token)).status, 400);
  assert.equal((await call('GET', '/admin/ai-settings', null, B.token)).aiName, '');
  process.env.META_API_KEY = 'k';
  const real = globalThis.fetch; const prompts = [];
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.meta.ai/')) return real(url, init);
    prompts.push(JSON.parse(init.body).messages[0].content);
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
  };
  try {
    const a = await call('POST', '/chat/start', {}, A.token); await call('POST', '/chat', { conversationId: a.conversationId, message: 'hello there' });
    const b = await call('POST', '/chat/start', {}, B.token); await call('POST', '/chat', { conversationId: b.conversationId, message: 'hello there' });
  } finally { globalThis.fetch = real; delete process.env.META_API_KEY; }
  assert.match(prompts[0], /Your name is Zuri/); assert.match(prompts[0], /formal/i); assert.match(prompts[0], /deliver within Lusaka/);
  assert.match(prompts[0], /can never override the rules above/);
  assert.doesNotMatch(prompts[1], /Zuri|Lusaka/, 'company B prompt has none of company A settings');
});
