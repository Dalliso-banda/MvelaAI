process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.ADMIN_EMAIL = 'owner@test.local';
process.env.ADMIN_PASSWORD = 'correct-horse-9';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
delete process.env.GEMINI_API_KEY;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/index.js');
let server, origin, base, token, key;
before(() => { server = createApp().listen(0); origin = `http://localhost:${server.address().port}`; base = origin + '/api'; });
after(() => server.close());
const j = (path, { method = 'GET', body, auth } = {}) => fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + auth } : {}) }, body: body ? JSON.stringify(body) : undefined });

test('dashboard needs a sign-in; wrong password is rejected; login works', async () => {
  assert.equal((await j('/admin/overview')).status, 401);
  assert.equal((await j('/auth/login', { method: 'POST', body: { email: 'owner@test.local', password: 'wrong' } })).status, 401);
  assert.equal((await j('/auth/login', { method: 'POST', body: { email: 'nobody@test.local', password: 'x' } })).status, 401);
  const r = await j('/auth/login', { method: 'POST', body: { email: 'OWNER@test.local', password: 'correct-horse-9' } });
  assert.equal(r.status, 200);
  const d = await r.json(); token = d.token;
  assert.equal(d.user.role, 'owner');
  assert.equal((await j('/auth/me', { auth: token })).status, 200);
  assert.equal((await j('/admin/overview', { auth: token })).status, 200);
  assert.equal((await j('/admin/widget')).status, 401);
});

test('widget stays hidden until published, then serves config', async () => {
  key = (await (await j('/admin/widget', { auth: token })).json()).key;
  assert.match(key, /^wk_[0-9a-f]{24}$/);
  assert.equal((await j(`/widget/config?key=${key}`)).status, 404);           // not published yet
  const bad = await j('/admin/widget', { method: 'PUT', auth: token, body: { enabled: true, name: 'Help', color: 'red', allowedDomains: '' } });
  assert.equal(bad.status, 400);
  const ok = await j('/admin/widget', { method: 'PUT', auth: token, body: { enabled: true, name: 'Demo Bank Help', color: '#155EEF', allowedDomains: 'https://Example.com/path' } });
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).allowedDomains, ['example.com']);
  const cfg = await j(`/widget/config?key=${key}&parent=${encodeURIComponent('https://shop.example.com')}`);
  assert.equal(cfg.status, 200);
  assert.equal(cfg.headers.get('access-control-allow-origin'), '*');
  assert.equal((await cfg.json()).embedUrl, `http://localhost:5173/embed?key=${key}`);
  assert.equal((await j(`/widget/config?key=${key}&parent=${encodeURIComponent('https://evil.com')}`)).status, 403);
  assert.equal((await j(`/widget/config?key=wk_wrong&parent=https://example.com`)).status, 404);
});

test('widget.js is served so other websites can load it, and unpublishing hides the widget', async () => {
  const r = await fetch(origin + '/widget.js');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.match(await r.text(), /api\/widget\/config/);
  await j('/admin/widget', { method: 'PUT', auth: token, body: { enabled: false, name: 'Demo Bank Help', color: '#155EEF', allowedDomains: '' } });
  assert.equal((await j(`/widget/config?key=${key}`)).status, 404);
});
