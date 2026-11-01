import { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, Switch, FormControlLabel, TextField, Button, Alert, Chip, Grid } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { api, useApi } from '../../api';
import { tk } from '../../theme';

export default function Widget() {
  const { data, error, reload } = useApi('/api/admin/widget');
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (data) setF({ enabled: data.enabled, name: data.name, color: data.color, allowedDomains: data.allowedDomains.join(', ') }); }, [data]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!f) return null;
  const snippet = `<script src="${data.scriptUrl}" data-key="${data.key}" async></script>`;

  async function save(next = f) {
    setMsg(null);
    try { await api('/api/admin/widget', { method: 'PUT', body: next }); setF(next); setMsg({ t: 'success', m: next.enabled ? 'Saved. Your widget is published.' : 'Saved. Your widget is unpublished.' }); reload(); }
    catch (e) { setMsg({ t: 'error', m: e.message }); }
  }
  async function copy() { try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* user can select the text */ } }

  return (
    <Box>
      <Typography variant="h3">Publish widget</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Add the Mvela chat bubble to your website with one line of code.</Typography>
      {msg && <Alert severity={msg.t} onClose={() => setMsg(null)} sx={{ mb: 2, borderRadius: 2 }}>{msg.m}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Card><CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h5">Settings</Typography>
              <Chip size="small" label={f.enabled ? 'Published' : 'Not published'} color={f.enabled ? 'success' : 'default'} />
            </Stack>
            <Stack spacing={2.5}>
              <FormControlLabel control={<Switch checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />} label="Publish the widget" />
              <TextField label="Widget name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} helperText="Shown at the top of the chat." fullWidth />
              <TextField label="Brand colour" type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} sx={{ maxWidth: 160 }} />
              <TextField label="Allowed websites (optional)" value={f.allowedDomains} onChange={(e) => setF({ ...f, allowedDomains: e.target.value })} placeholder="mybank.co.zm, shop.mybank.co.zm" helperText="Leave empty to allow any site. This stops casual copying of your snippet; it is not a security control." fullWidth multiline />
              <Button variant="contained" size="large" onClick={() => save()}>Save changes</Button>
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Stack spacing={2.5}>
            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ mb: 1 }}>1. Copy your snippet</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 14, mb: 1.5 }}>Paste it just before the closing &lt;/body&gt; tag of every page that should show the chat.</Typography>
              <Box sx={{ p: 1.5, bgcolor: tk.n900, color: '#E2E8F0', borderRadius: 2, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{snippet}</Box>
              <Button startIcon={<ContentCopyIcon />} onClick={copy} sx={{ mt: 1.5 }} variant="outlined">{copied ? 'Copied' : 'Copy snippet'}</Button>
            </CardContent></Card>
            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ mb: 1 }}>2. Try it first</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 14, mb: 1.5 }}>Opens a sample website with your widget on it. Publish and save first.</Typography>
              <Button variant="outlined" href={`/widget-test.html?key=${data.key}`} target="_blank" rel="noreferrer">Open test website</Button>
            </CardContent></Card>
            <Alert severity="info" sx={{ borderRadius: 2 }}>This prototype answers from synthetic data and shows verification codes in the chat. Do not connect it to real customers until SMS delivery and a real bank connection are in place.</Alert>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
