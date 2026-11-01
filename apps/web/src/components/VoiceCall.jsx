import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import CallIcon from '@mui/icons-material/Call';
import CallEndIcon from '@mui/icons-material/CallEnd';

// Browser voice call: speech-to-text -> your chat endpoint -> text-to-speech, turn by turn.
// Works in Chrome, Edge and Safari. English only (browsers do not offer Bemba/Nyanja speech yet).
// Needs HTTPS (or localhost) for the microphone.
const Rec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const voiceSupported = () => Boolean(Rec) && typeof window !== 'undefined' && 'speechSynthesis' in window;
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

export default function VoiceCall({ onUtterance, color = '#155EEF', disabled = false, lang = 'en-GB', greeting = "Hello, I'm listening. How can I help?" }) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const activeRef = useRef(false);
  const gen = useRef(0);
  const recRef = useRef(null);
  const skip = useRef(false);
  const props = useRef({});
  props.current = { onUtterance, lang, greeting };

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

  const fail = useCallback((msg) => { setError(msg); activeRef.current = false; gen.current++; setActive(false); setStatus('idle'); }, []);

  const listen = useCallback(function listen() {
    if (!activeRef.current) return;
    const g = ++gen.current;
    const rec = new Rec();
    recRef.current = rec;
    rec.lang = props.current.lang;
    rec.interimResults = true;
    rec.continuous = false;
    let handled = false;
    setStatus('listening');
    rec.onresult = (e) => {
      let interim = '', fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (interim += e.results[i][0].transcript));
      setHeard(fin || interim);
      if (fin.trim() && !handled) {
        handled = true;
        try { rec.stop(); } catch { /* ignore */ }
        (async () => {
          setStatus('thinking');
          let reply = '';
          try { reply = await props.current.onUtterance(fin.trim()); } catch { /* the chat shows the error */ }
          if (!activeRef.current || gen.current !== g) return;
          setHeard('');
          if (reply) await speak(reply);
          listen();
        })();
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fail('Microphone is blocked. Allow it for this site, then try again.');
      else if (e.error === 'network') fail('Voice needs an internet connection.');
      else fail('Voice error: ' + e.error);
    };
    rec.onend = () => { if (!handled && activeRef.current && gen.current === g) setTimeout(() => { if (activeRef.current && gen.current === g) listen(); }, 250); };
    try { rec.start(); } catch { /* already started */ }
  }, [speak, fail]);

  const start = async () => {
    setError('');
    activeRef.current = true;
    setActive(true);
    await speak(props.current.greeting); // runs inside the click, which browsers require for audio
    listen();
  };
  const end = useCallback(() => {
    activeRef.current = false;
    gen.current++;
    try { recRef.current?.abort(); } catch { /* ignore */ }
    window.speechSynthesis?.cancel();
    setActive(false); setStatus('idle'); setHeard('');
  }, []);
  useEffect(() => end, [end]);

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
        <Button size="small" color="error" variant="contained" startIcon={<CallEndIcon />} onClick={end}>End call</Button>
      </Box>
      {heard && <Typography sx={{ fontSize: 13.5, color: '#475569', mt: 0.75, fontStyle: 'italic' }}>“{heard}”</Typography>}
    </Box>
  );
}
