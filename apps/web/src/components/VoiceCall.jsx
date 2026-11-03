import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import CallIcon from '@mui/icons-material/Call';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { captureSupported, openMic } from '../lib/voiceCapture';

// Voice call: the microphone is recorded in the browser, each utterance is sent to our API and transcribed by Meta's
// Muse Voice Transcribe, the text goes through the same agents as typed chat, and the reply is read aloud with the
// browser's text-to-speech (Meta has no text-to-speech model yet). Needs HTTPS (or localhost) for the microphone.
export const voiceSupported = () => typeof window !== 'undefined' && captureSupported() && 'speechSynthesis' in window;
const pulse = keyframes`0%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.4}100%{transform:scale(1);opacity:1}`;

/** Make text sound right when read aloud. */
export function speechText(t) {
  return String(t || '')
    .replace(/\b(\d{6})\b/g, (m) => m.split('').join(' '))
    .replace(/TXN-(\d+)/gi, (_m, d) => 'reference ' + d.split('').join(' '))
    .replace(/\bK\s?(\d[\d,]*)(\.\d{2})?/g, (_m, a, b) => (b && b !== '.00' ? `${a} kwacha ${b.slice(1)} ngwee` : `${a} kwacha`))
    .replace(/[•*_#]/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function VoiceCall({ onUtterance, transcribe, color = '#155EEF', disabled = false, lang = 'en-GB', greeting = "Hello, I'm listening. How can I help?" }) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const activeRef = useRef(false);
  const gen = useRef(0);
  const micRef = useRef(null);
  const skip = useRef(false);
  const props = useRef({});
  props.current = { onUtterance, transcribe, lang, greeting };

  const speak = useCallback((text) => new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    skip.current = false;
    setStatus('speaking');
    const plain = speechText(text);
    // Chrome cuts long utterances off, so speak sentence-sized chunks.
    const chunks = [];
    for (const s of plain.match(/[^.!?]+[.!?]*\s*/g) || [plain]) {
      if (chunks.length && (chunks[chunks.length - 1] + s).length < 160) chunks[chunks.length - 1] += s; else chunks.push(s);
    }
    const l = props.current.lang;
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === l) || voices.find((v) => v.lang.startsWith('en'));
    let i = 0;
    const next = () => {
      if (i >= chunks.length || !activeRef.current || skip.current) return resolve();
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      if (voice) u.voice = voice;
      u.lang = l;
      u.onend = next;
      u.onerror = next;
      synth.speak(u);
    };
    next();
  }), []);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    gen.current++;
    try { micRef.current?.close(); } catch { /* ignore */ }
    micRef.current = null;
    window.speechSynthesis?.cancel();
    setActive(false); setStatus('idle'); setHeard('');
  }, []);
  const fail = useCallback((msg) => { setError(msg); stopAll(); }, [stopAll]);

  // One turn at a time: listen, transcribe with Muse, ask the agents, speak the reply.
  const loop = useCallback(async (g) => {
    let misses = 0;
    while (activeRef.current && gen.current === g) {
      setStatus('listening');
      const blob = await micRef.current.listen();
      if (!activeRef.current || gen.current !== g) return;
      if (!blob) continue;
      setStatus('thinking');
      let text = '';
      try { text = (await props.current.transcribe(blob)).trim(); misses = 0; }
      catch (e) {
        if (++misses >= 3) return fail(e.message || 'Voice is not working right now. You can still type.');
        continue;
      }
      if (!activeRef.current || gen.current !== g) return;
      if (!text) continue;
      setHeard(text);
      let reply = '';
      try { reply = await props.current.onUtterance(text); } catch { /* the chat shows the error */ }
      if (!activeRef.current || gen.current !== g) return;
      setHeard('');
      if (reply) await speak(reply);
    }
  }, [speak, fail]);

  const start = async () => {
    setError('');
    try { micRef.current = await openMic(); }
    catch { setError('Microphone is blocked. Allow it for this site, then try again.'); return; }
    activeRef.current = true;
    setActive(true);
    const g = ++gen.current;
    await speak(props.current.greeting); // runs inside the click, which browsers require for audio
    loop(g);
  };
  useEffect(() => stopAll, [stopAll]);

  if (!voiceSupported()) return null;

  if (!active) {
    return (
      <Box sx={{ px: 1.5, pt: 1.25, borderTop: '1px solid #E2E8F0' }}>
        <Button fullWidth variant="outlined" startIcon={<CallIcon />} onClick={start} disabled={disabled}
          sx={{ color, borderColor: color, '&:hover': { borderColor: color, bgcolor: 'transparent' } }}>
          Talk to the assistant
        </Button>
        {error && <Typography sx={{ fontSize: 13, color: '#B42318', mt: 1 }}>{error}</Typography>}
      </Box>
    );
  }
  const label = { listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', idle: '' }[status];
  return (
    <Box sx={{ px: 1.5, py: 1.25, borderTop: '1px solid #E2E8F0', bgcolor: '#F8FAFC' }} role="status" aria-live="polite">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: status === 'listening' ? '#15803D' : color, animation: `${pulse} 1.4s ease-in-out infinite` }} />
        <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</Typography>
        {status === 'speaking' && <Button size="small" onClick={() => { skip.current = true; window.speechSynthesis.cancel(); }}>Skip</Button>}
        <Button size="small" color="error" variant="contained" startIcon={<CallEndIcon />} onClick={stopAll}>End call</Button>
      </Box>
      {heard && <Typography sx={{ fontSize: 13.5, color: '#475569', mt: 0.75, fontStyle: 'italic' }}>“{heard}”</Typography>}
    </Box>
  );
}
