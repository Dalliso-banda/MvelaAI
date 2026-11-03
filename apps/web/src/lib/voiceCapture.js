import { downsample, encodeWav } from './wav';

// Microphone capture with simple voice-activity detection. listen() waits for the person to speak, records until
// they pause, and resolves with one utterance as a 16 kHz mono WAV Blob (what Muse Voice Transcribe takes).
// Nothing is recorded while nobody is listening, e.g. while the assistant is speaking, so it never hears itself.
export const captureSupported = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(window.AudioContext || window.webkitAudioContext);

const rmsOf = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
const SILENCE_MS = 1100;   // pause that ends an utterance
const MIN_SPEECH_MS = 350; // shorter than this is a cough or a click
const MAX_MS = 25000;      // hard cap per utterance
const WAIT_MS = 60000;     // give up waiting for speech and let the caller loop

export async function openMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  if (ctx.state === 'suspended') await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  let cur = null;

  proc.onaudioprocess = (e) => {
    if (!cur) return;
    const data = new Float32Array(e.inputBuffer.getChannelData(0)); // copy: the browser reuses the buffer
    const ms = (data.length / ctx.sampleRate) * 1000;
    const level = rmsOf(data);
    const s = cur;
    s.elapsed += ms;
    if (s.calibrating > 0) { s.noise = Math.max(s.noise, level); s.calibrating -= ms; return; }
    const threshold = Math.max(0.012, s.noise * 3);
    const voiced = level > threshold;
    if (!s.speaking) {
      s.pre.push(data); if (s.pre.length > 3) s.pre.shift();
      s.voicedRun = voiced ? s.voicedRun + ms : 0;
      if (s.voicedRun >= 120) { s.speaking = true; s.chunks = [...s.pre]; s.speechMs = s.voicedRun; s.silence = 0; }
      else if (s.elapsed > WAIT_MS) s.done(null);
      return;
    }
    s.chunks.push(data);
    if (voiced) { s.speechMs += ms; s.silence = 0; } else s.silence += ms;
    s.total += ms;
    if (s.silence >= SILENCE_MS || s.total >= MAX_MS) s.finish();
  };
  src.connect(proc);
  proc.connect(ctx.destination); // required for the processor to run; it outputs silence

  function listen() {
    return new Promise((resolve) => {
      const s = {
        elapsed: 0, calibrating: 250, noise: 0.004, speaking: false, voicedRun: 0, pre: [], chunks: [], speechMs: 0, silence: 0, total: 0,
        done: (v) => { if (cur === s) cur = null; resolve(v); },
        finish: () => {
          if (s.speechMs < MIN_SPEECH_MS) return s.done(null);
          const n = s.chunks.reduce((a, c) => a + c.length, 0);
          const all = new Float32Array(n); let o = 0;
          for (const c of s.chunks) { all.set(c, o); o += c.length; }
          s.done(new Blob([encodeWav(downsample(all, ctx.sampleRate))], { type: 'audio/wav' }));
        },
      };
      cur = s;
      listen.cancel = () => s.done(null);
    });
  }
  const cancel = () => { listen.cancel?.(); };
  function close() {
    cancel();
    try { proc.disconnect(); src.disconnect(); } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  }
  return { listen, cancel, close };
}
