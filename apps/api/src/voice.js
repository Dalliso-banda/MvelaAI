// Voice: audio from the widget is transcribed by Meta's Muse Voice Transcribe. Audio is never stored; only the
// length and the character count of the transcript are written to the audit log. The text then goes through
// the normal chat endpoint, so redaction, risk rules and the agents all apply to spoken messages too.
import express from 'express';
import { db, audit, getCompany } from './db.js';

const MAX_BYTES = 3 * 1024 * 1024; // about 90 s of 16 kHz mono; the widget caps an utterance at 25 s
const MIN_MS = 300, MAX_MS = 60000;

/** Check the RIFF/WAVE header: mono, 16-bit PCM, 16 or 24 kHz. Returns { ms } or { error }. */
export function parseWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44) return { error: 'Not a WAV file.' };
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return { error: 'Not a WAV file.' };
  let off = 12, fmt = null, dataLen = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ' && off + 8 + 16 <= buf.length) fmt = { format: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') { dataLen = Math.min(size, buf.length - off - 8); break; }
    off += 8 + size + (size % 2);
  }
  if (!fmt || dataLen == null) return { error: 'Not a WAV file.' };
  if (fmt.format !== 1 || fmt.channels !== 1 || fmt.bits !== 16 || ![16000, 24000].includes(fmt.rate)) return { error: 'Audio must be mono 16-bit WAV at 16 or 24 kHz.' };
  const ms = Math.round((dataLen / (fmt.rate * 2)) * 1000);
  if (ms < MIN_MS) return { error: 'That was too short to hear.' };
  if (ms > MAX_MS) return { error: 'That was too long. Please say it in shorter pieces.' };
  return { ms };
}

export async function transcribeWav(buf, { sessionId, keywords = [] } = {}) {
  const base = (process.env.META_API_BASE || 'https://api.meta.ai/v1').replace(/\/$/, '');
  const langs = (process.env.VOICE_LANGUAGES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const settings = {
    mode: 'PUSH_TO_TALK', model: process.env.META_STT_MODEL || 'muse-voice-transcribe-1.0', audioEncoding: 'WAV',
    ...(langs.length ? { languageBias: langs } : {}), ...(keywords.length ? { keywords } : {}),
  };
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(settings)], { type: 'application/json' }));
  form.append('audio', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${base}/asr/transcribe?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST', signal: ctrl.signal, headers: { authorization: `Bearer ${process.env.META_API_KEY}` }, body: form,
    });
    if (!res.ok) throw new Error(`Muse transcribe ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return String(data.transcript || '').trim();
  } finally { clearTimeout(timer); }
}

export function mountVoice(router, { limiter, wrap }) {
  router.post('/voice/transcribe', limiter, express.raw({ type: ['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'], limit: MAX_BYTES }), wrap(async (req, res) => {
    if (!process.env.META_API_KEY) return res.status(503).json({ error: 'Voice is not set up on this server.' });
    const conv = db.prepare('SELECT id, company_id FROM conversations WHERE id=?').get(String(req.query.conversationId || ''));
    if (!conv) return res.status(404).json({ error: 'Chat not found.' });
    const info = parseWav(req.body);
    if (info.error) return res.status(400).json({ error: info.error });
    const company = getCompany(conv.company_id);
    const keywords = [company?.name, company?.ai_name].filter(Boolean).map((k) => String(k).slice(0, 40)).slice(0, 5);
    try {
      const text = await transcribeWav(req.body, { sessionId: conv.id, keywords });
      audit(conv.id, null, 'system', 'voice_transcribe', { ms: info.ms, chars: text.length });
      res.json({ text });
    } catch (e) {
      audit(conv.id, null, 'system', 'voice_error', { error: String(e.message).slice(0, 200) });
      console.warn('[voice]', e.message);
      res.status(502).json({ error: "I couldn't make that out. Please try again, or type your message." });
    }
  }));
}
