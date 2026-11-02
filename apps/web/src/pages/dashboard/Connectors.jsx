import { useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { tk } from '../../theme';
import { api, useApi } from '../../api';
import { ApiError, Loading } from '../../components/ApiState';

const empty = { id: null, name: '', description: '', urlTemplate: '', params: '', authHeader: '', authSecret: '', fields: '' };
const toForm = (c) => ({ ...c, params: c.params.map((p) => p.name).join(', '), fields: c.fields.join(', '), authHeader: c.authHeader || '', authSecret: '' });
const toBody = (f) => ({
  name: f.name, description: f.description, urlTemplate: f.urlTemplate, authHeader: f.authHeader, authSecret: f.authSecret, fields: f.fields,
  params: f.params.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name, description: name.replace(/_/g, ' ') })),
});

export default function Connectors() {
  const { data, error, loading, reload } = useApi('/api/admin/connectors');
  const [edit, setEdit] = useState(null);
  const [test, setTest] = useState(null);
  const [err, setErr] = useState('');

  async function save() {
    try {
      if (edit.id) await api(`/api/admin/connectors/${edit.id}`, { method: 'PUT', body: toBody(edit) });
      else await api('/api/admin/connectors', { method: 'POST', body: toBody(edit) });
      setEdit(null); setErr(''); reload();
    } catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this lookup? The AI will stop using it immediately.')) return;
    try { await api(`/api/admin/connectors/${id}`, { method: 'DELETE' }); reload(); } catch (e) { setErr(e.message); }
  }
  async function runTest() {
    try { const r = await api(`/api/admin/connectors/${test.c.id}/test`, { method: 'POST', body: { args: test.args } }); setTest({ ...test, result: r }); }
    catch (e) { setTest({ ...test, result: { error: e.message } }); }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3">Lookups</Typography>
          <Typography color="text.secondary">Let the AI check your own systems, like an order status, a booking or a ticket. You choose exactly which fields it may share.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setErr(''); setEdit({ ...empty }); }} sx={{ flexShrink: 0, ml: 2 }}>Add lookup</Button>
      </Stack>
      <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>Customers are not signed in, so anyone who knows the details a lookup asks for (like an order number) can see what it returns. Only share fields that are safe for that, such as status and dates, never personal data.</Alert>
      <ApiError error={error} />
      {err && !edit && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {loading && !data ? <Loading /> : (
        <Stack spacing={2}>
          {data?.length === 0 && <Typography color="text.secondary">No lookups yet. Your AI answers from the knowledge base only.</Typography>}
          {data?.map((c) => (
            <Card key={c.id}><CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" sx={{ mb: .5 }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: 14.5, color: tk.n700, mb: 1 }}>{c.description}</Typography>
                  <Typography sx={{ fontSize: 13, color: tk.n500, mb: 1, wordBreak: 'break-all' }}>GET {c.urlTemplate}{c.hasSecret ? `  ·  ${c.authHeader}: ••••••` : ''}</Typography>
                  <Stack direction="row" gap={.5} flexWrap="wrap">{c.fields.map((t) => <Chip key={t} size="small" label={t} sx={{ bgcolor: tk.n100, height: 22 }} />)}</Stack>
                </Box>
                <Stack direction="row" sx={{ flexShrink: 0 }}>
                  <IconButton aria-label="Test" onClick={() => setTest({ c, args: Object.fromEntries(c.params.map((p) => [p.name, ''])), result: null })}><PlayArrowIcon fontSize="small" /></IconButton>
                  <IconButton aria-label="Edit" onClick={() => { setErr(''); setEdit(toForm(c)); }}><EditOutlinedIcon fontSize="small" /></IconButton>
                  <IconButton aria-label="Delete" onClick={() => remove(c.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
            </CardContent></Card>
          ))}
        </Stack>
      )}

      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>{edit?.id ? 'Edit lookup' : 'New lookup'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {err && <Alert severity="error">{err}</Alert>}
            <TextField label="Name" value={edit?.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} helperText="Lowercase, e.g. order_status" fullWidth required />
            <TextField label="What it does" value={edit?.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} helperText="So the AI knows when to use it, e.g. Look up an order's status by its order number." fullWidth required />
            <TextField label="Your API address" value={edit?.urlTemplate ?? ''} onChange={(e) => setEdit({ ...edit, urlTemplate: e.target.value })} helperText="Must be https. Use {order_id} where the customer's detail goes: https://api.yourshop.com/orders/{order_id}" fullWidth required />
            <TextField label="What the customer provides" value={edit?.params ?? ''} onChange={(e) => setEdit({ ...edit, params: e.target.value })} helperText="Names matching the {placeholders}, comma separated: order_id" fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Auth header name (optional)" value={edit?.authHeader ?? ''} onChange={(e) => setEdit({ ...edit, authHeader: e.target.value })} helperText="e.g. Authorization or x-api-key" fullWidth />
              <TextField label="Secret value" type="password" autoComplete="off" value={edit?.authSecret ?? ''} onChange={(e) => setEdit({ ...edit, authSecret: e.target.value })} helperText={edit?.id && edit?.hasSecret ? 'Leave blank to keep the saved one' : 'Stored encrypted, never shown again'} fullWidth />
            </Stack>
            <TextField label="Fields the AI may share" value={edit?.fields ?? ''} onChange={(e) => setEdit({ ...edit, fields: e.target.value })} helperText="Comma separated, e.g. status, estimated_delivery. Everything else is hidden." fullWidth required />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(test)} onClose={() => setTest(null)} fullWidth maxWidth="sm">
        <DialogTitle>Test {test?.c.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {test && Object.keys(test.args).map((k) => <TextField key={k} label={k} value={test.args[k]} onChange={(e) => setTest({ ...test, args: { ...test.args, [k]: e.target.value } })} fullWidth />)}
            {test?.result && <Box component="pre" sx={{ m: 0, p: 2, bgcolor: tk.n100, borderRadius: 2, fontSize: 13, overflow: 'auto' }}>{JSON.stringify(test.result, null, 2)}</Box>}
            <Typography sx={{ fontSize: 13, color: tk.n500 }}>This is exactly what the AI would see.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setTest(null)}>Close</Button><Button variant="contained" onClick={runTest}>Run test</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
