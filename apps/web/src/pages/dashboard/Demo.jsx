import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, TextField, IconButton, Chip, Grid, Alert, Divider, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { tk } from '../../theme';
import { api, useApi } from '../../api';
import StatusChip from '../../components/StatusChip';

const KEY = 'mvela_demo_conv';
const QUICK = ['What is my balance?', 'My mobile money transfer failed, what happened?', 'Show my last transactions', 'What are your opening hours?', 'Please block my card', 'Someone took money from my account'];

function Bubble({ m }) {
  const me = m.role === 'customer';
  return (
    <Box sx={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
      <Box sx={{ maxWidth: '82%', px: 1.75, py: 1.25, borderRadius: 2.5, whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.5,
        bgcolor: me ? tk.primary : '#fff', color: me ? '#fff' : tk.n900, border: me ? 0 : `1px solid ${tk.n200}`, borderBottomRightRadius: me ? 4 : undefined, borderBottomLeftRadius: me ? undefined : 4 }}>
        {m.content}
      </Box>
    </Box>
  );
}

export default function Demo() {
  const [convId, setConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({ state: 'new', status: 'open', language: 'English', verified: false });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const booted = useRef(false);
  const { data: customers } = useApi('/api/demo/customers');

  async function start() {
    setError('');
    try {
      const { conversationId, greeting } = await api('/api/chat/start', { method: 'POST', body: {} });
      setConvId(conversationId); setMessages([{ role: 'assistant', content: greeting }]);
      setMeta({ state: 'new', status: 'open', language: 'English', verified: false });
      try { sessionStorage.setItem(KEY, conversationId); } catch { /* ignore */ }
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    if (booted.current) return; // StrictMode runs effects twice in dev; don't open two chats
    booted.current = true;
    (async () => {
      let saved = null; try { saved = sessionStorage.getItem(KEY); } catch { /* ignore */ }
      if (saved) {
        try {
          const c = await api(`/api/chat/${saved}`);
          setConvId(c.id); setMessages(c.messages); setMeta({ state: c.state, status: c.status, language: c.language, verified: c.verified });
          return;
        } catch { /* fall through to new chat */ }
      }
      start();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || busy || !convId) return;
    setInput(''); setBusy(true); setError('');
    setMessages((m) => [...m, { role: 'customer', content: t }]);
    try {
      const r = await api('/api/chat', { method: 'POST', body: { conversationId: convId, message: t } });
      setMessages((m) => [...m, ...(r.warning ? [{ role: 'assistant', content: r.warning }] : []), { role: 'assistant', content: r.reply }]);
      setMeta({ state: r.state, status: r.status, language: r.language, verified: r.verified });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3">Live demo</Typography>
          <Typography color="text.secondary">Talk to the agent as a bank customer. Everything here is real: it verifies you, queries the database, logs an audit trail and escalates risky requests.</Typography>
        </Box>
        <Button startIcon={<RestartAltIcon />} variant="outlined" onClick={start} sx={{ flexShrink: 0, ml: 2 }}>New chat</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7.5}>
          <Card sx={{ display: 'flex', flexDirection: 'column', height: 600 }}>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, bgcolor: tk.n50 }}>
              <Stack spacing={1.5}>
                {messages.map((m, i) => <Bubble key={i} m={m} />)}
                {busy && <Typography sx={{ color: tk.n500, fontSize: 13 }}>Mvela is typing…</Typography>}
                <div ref={endRef} />
              </Stack>
            </Box>
            <Divider />
            <Stack direction="row" spacing={1} sx={{ p: 1.5 }} component="form" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <TextField value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…" size="small" fullWidth autoComplete="off" inputProps={{ 'aria-label': 'Message', maxLength: 1000 }} />
              <IconButton type="submit" color="primary" disabled={busy || !input.trim()} aria-label="Send"><SendIcon /></IconButton>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} md={4.5}>
          <Stack spacing={2.5}>
            <Card><CardContent sx={{ p: 2.5 }}>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Session</Typography>
              <Stack spacing={1}>
                {[['Identity', meta.verified ? <Chip size="small" color="success" label="Verified (OTP)" /> : <Chip size="small" variant="outlined" label="Not verified" />],
                  ['Flow state', <Typography sx={{ fontSize: 14 }}>{meta.state}</Typography>],
                  ['Outcome', <StatusChip status={meta.status} />],
                  ['Language', <Typography sx={{ fontSize: 14 }}>{meta.language}</Typography>]].map(([k, v]) => (
                  <Stack key={k} direction="row" justifyContent="space-between" alignItems="center"><Typography color="text.secondary" sx={{ fontSize: 14 }}>{k}</Typography>{v}</Stack>
                ))}
              </Stack>
            </CardContent></Card>

            <Card><CardContent sx={{ p: 2.5 }}>
              <Typography variant="h5" sx={{ mb: 1 }}>Try saying</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {QUICK.map((q) => <Chip key={q} label={q} onClick={() => send(q)} disabled={busy} variant="outlined" sx={{ height: 'auto', py: .5, '& .MuiChip-label': { whiteSpace: 'normal' } }} />)}
              </Stack>
            </CardContent></Card>

            <Card><CardContent sx={{ p: 2.5 }}>
              <Typography variant="h5" sx={{ mb: 1 }}>Synthetic customers</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13.5, mb: 1.5 }}>When asked for a registered number, type one of these. The code appears in the chat (demo mode, no SMS).</Typography>
              <Stack spacing={.75}>
                {(customers || []).map((c) => (
                  <Stack key={c.phone} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 13.5 }}>{c.name}</Typography>
                    <Chip size="small" label={c.phone} onClick={() => setInput(c.phone)} sx={{ fontFamily: 'monospace' }} />
                  </Stack>
                ))}
              </Stack>
              <Typography color="text.secondary" sx={{ fontSize: 12.5, mt: 1.5 }}>Customer 1 has a failed and a pending mobile money transfer, a good one to start with.</Typography>
            </CardContent></Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
