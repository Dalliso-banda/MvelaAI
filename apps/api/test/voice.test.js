process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.OTP_DEMO = 'true';
process.env.CHAT_RATE_LIMIT = '10000';
process.env.VOICE_RATE_LIMIT = '10000';
delete process.env.META_API_KEY;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../src/index.js');
const { seedAll } = await import('../src/seed.js');
const { db } = await import('../src/db.js');
const { parseWav } = await import('../src/voice.js');
const { encodeWav, downsample } = await import('../../web/src/lib/wav.js');

let server, base;
before(() => { seedAll(); server = createApp().listen(0); base = `http://localhost:${server.address().port}/api`; });
after(() => server.close());

const tone = (seconds, rate = 16000) => Float32Array.from({ length: Math.floor(seconds * rate) }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / rate));
const wav = (seconds) => Buffer.from(encodeWav(tone(seconds)));
const start = () => fetch(base + '/chat/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json()).then((d) => d.conversationId);
const send = (id, body, type = 'audio/wav') => fetch(`${base}/voice/transcribe?conversationId=${id}`, { method: 'POST', headers: { 'content-type': type }, body });

test('the browser encoder makes a WAV the server accepts, and downsampling hits 16 kHz', () => {
  const w = wav(1.5);
  assert.deepEqual(parseWav(w), { ms: 1500 });
  const down = downsample(tone(1, 48000), 48000);
  assert.equal(down.length, 16000);
});

test('parseWav rejects junk, stereo, wrong rate, too short and too long', () => {
  assert.ok(parseWav(Buffer.from('not audio at all, definitely not a wav file header....')).error);
  const stereo = wav(1); stereo.writeUInt16LE(2, 22); assert.ok(parseWav(stereo).error);
  const wrongRate = wav(1); wrongRate.writeUInt32LE(44100, 24); assert.ok(parseWav(wrongRate).error);
  assert.match(parseWav(wav(0.1)).error, /short/);
  assert.match(parseWav(wav(61)).error, /long/);
});

test('voice endpoint: not configured without a Meta key, unknown chat, bad audio', async () => {
  const id = await start();
  assert.equal((await send(id, wav(1))).status, 503);
  process.env.META_API_KEY = 'test-meta-key';
  try {
    assert.equal((await send('nope', wav(1))).status, 404);
    assert.equal((await send(id, Buffer.from('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'))).status, 400);
  } finally { delete process.env.META_API_KEY; }
});

test('voice endpoint sends the audio to Muse Voice Transcribe and returns the transcript', async () => {
  const id = await start();
  process.env.META_API_KEY = 'test-meta-key';
  const real = globalThis.fetch; let seen;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.meta.ai/v1/asr/transcribe')) return real(url, init);
    seen = { url: String(url), auth: init.headers.authorization, form: init.body };
    return new Response(JSON.stringify({ sessionId: 's', transcript: ' what is my balance ', audioDurationMs: 1000, turns: [] }));
  };
  try {
    const r = await send(id, wav(1));
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { text: 'what is my balance' });
    assert.ok(seen.url.includes(`sessionId=${id}`));
    assert.equal(seen.auth, 'Bearer test-meta-key');
    const settings = JSON.parse(await seen.form.get('request').text());
    assert.equal(settings.model, 'muse-voice-transcribe-1.0');
    assert.equal(settings.audioEncoding, 'WAV');
    assert.ok(settings.keywords.length >= 1);
    const audio = seen.form.get('audio');
    assert.equal(audio.type, 'audio/wav');
    assert.deepEqual(parseWav(Buffer.from(await audio.arrayBuffer())), { ms: 1000 });
    const log = JSON.parse(db.prepare("SELECT detail FROM audit_logs WHERE conversation_id=? AND action='voice_transcribe'").get(id).detail);
    assert.deepEqual(log, { ms: 1000, chars: 18 }); // no audio and no transcript text in the log
  } finally { globalThis.fetch = real; delete process.env.META_API_KEY; }
});

test('voice endpoint: a Muse failure gives a gentle error, not a crash', async () => {
  const id = await start();
  process.env.META_API_KEY = 'test-meta-key';
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes('/asr/transcribe') ? new Response('down', { status: 503 }) : real(url, init);
  try {
    const r = await send(id, wav(1));
    assert.equal(r.status, 502);
    assert.match((await r.json()).error, /try again|type/);
    assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE conversation_id=? AND action='voice_error'").get(id));
  } finally { globalThis.fetch = real; delete process.env.META_API_KEY; }
});
