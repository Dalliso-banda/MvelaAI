// Pure audio helpers: turn microphone samples into the WAV Muse Voice Transcribe expects (mono, 16-bit PCM, 16 kHz).
export const TARGET_RATE = 16000;

/** Average-downsample Float32 samples from `rate` Hz to 16 kHz. */
export function downsample(samples, rate) {
  if (rate === TARGET_RATE) return samples;
  const ratio = rate / TARGET_RATE;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(samples.length, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = a; j < b; j++) sum += samples[j];
    out[i] = sum / (b - a);
  }
  return out;
}

/** 16 kHz Float32 samples (-1..1) to a 16-bit mono PCM WAV (ArrayBuffer). */
export function encodeWav(samples, rate = TARGET_RATE) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}
