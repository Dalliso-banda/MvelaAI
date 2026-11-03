import { useEffect, useRef, useState } from 'react';
import { Box, Typography, TextField, IconButton, Stack } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api';
import VoiceCall from '../components/VoiceCall';

const q = new URLSearchParams(window.location.search);
const KEY = q.get('key') || '';
const PARENT = q.get('parent') || '';
const SKEY = `mvela_embed_${KEY}`;

export default function Embed() {
  const [cfg, setCfg] = useState(null);
  const [fail, setFail] = useState('');
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return; booted.current = true;
    (async () => {
      try {
        const c = await api(`/api/widget/config?key=${encodeURIComponent(KEY)}&parent=${encodeURIComponent(PARENT)}`);
        setCfg(c);
        let saved = null; try { saved = sessionStorage.getItem(SKEY); } catch { /* ignore */ }
        if (saved) { try { const d = await api(`/api/chat/${saved}`); setConv(d.id); setMsgs(d.messages.map((m) => ({ role: m.role, content: m.content }))); return; } catch { /* start fresh */ } }
        const s = await api('/api/chat/start', { method: 'POST', body: { key: KEY } });
        setConv(s.conversationId); setMsgs([{ role: 'assistant', content: s.greeting }]);
        try { sessionStorage.setItem(SKEY, s.conversationId); } catch { /* ignore */ }
      } catch (e) { setFail(e.message); }
    })();
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  async function submit(t) {
    if (!t || busy || !conv) return '';
    setBusy(true); setMsgs((m) => [...m, { role: 'customer', content: t }]);
    try {
      const r = await api('/api/chat', { method: 'POST', body: { conversationId: conv, message: t } });
      setMsgs((m) => [...m, ...(r.warning ? [{ role: 'assistant', content: r.warning }] : []), { role: 'assistant', content: r.reply }]);
      return r.reply;
    } catch (x) { setMsgs((m) => [...m, { role: 'system', content: x.message }]); return ''; } finally { setBusy(false); }
  }
  async function send(e) {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    setText(''); await submit(t);
  }
  const close = () => window.parent !== window && window.parent.postMessage('mvela-close', PARENT || '*');

  if (fail) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography sx={{ fontWeight: 600 }}>Chat is not available right now.</Typography><Typography color="text.secondary" sx={{ fontSize: 14, mt: 1 }}>{fail}</Typography></Box>;
  if (!cfg) return null;
  const c = cfg.color;
  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      <Box sx={{ bgcolor: c, color: '#fff', px: 2, py: 1.5, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 600 }}>{cfg.name}</Typography><Typography sx={{ fontSize: 12.5, opacity: 0.9 }}>AI assistant · Powered by Mvela AI</Typography></Box>
        {window.parent !== window && <IconButton onClick={close} aria-label="Close chat" sx={{ color: '#fff' }}><CloseIcon /></IconButton>}
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#F8FAFC' }}>
        <Stack spacing={1.5}>
          {msgs.map((m, i) => m.role === 'system' ? <Typography key={i} sx={{ textAlign: 'center', fontSize: 13, color: '#B42318' }}>{m.content}</Typography> : (
            <Box key={i} sx={{ display: 'flex', justifyContent: m.role === 'customer' ? 'flex-end' : 'flex-start' }}>
              <Box sx={{ maxWidth: '85%', px: 1.75, py: 1.25, borderRadius: 2.5, whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.5, bgcolor: m.role === 'customer' ? c : '#fff', color: m.role === 'customer' ? '#fff' : '#0F172A', border: m.role === 'customer' ? 0 : '1px solid #E2E8F0' }}>{m.content}</Box>
            </Box>))}
          {busy && <Typography sx={{ fontSize: 13, color: '#64748B' }}>Typing…</Typography>}
          <div ref={end} />
        </Stack>
      </Box>
      <VoiceCall onUtterance={submit} color={c} disabled={!conv} />
      <Stack direction="row" spacing={1} component="form" onSubmit={send} sx={{ p: 1.5, borderTop: '1px solid #E2E8F0' }}>
        <TextField value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message…" size="small" fullWidth autoComplete="off" inputProps={{ 'aria-label': 'Message', maxLength: 1000, style: { fontSize: 16 } }} />
        <IconButton type="submit" disabled={busy || !text.trim()} aria-label="Send" sx={{ color: c }}><SendIcon /></IconButton>
      </Stack>
    </Box>
  );
}
