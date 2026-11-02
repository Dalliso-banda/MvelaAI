import { useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { tk } from '../../theme';
import { api, useApi } from '../../api';
import { ApiError, Loading } from '../../components/ApiState';

const empty = { id: null, title: '', body: '', tags: '' };

export default function Knowledge() {
  const { data, error, loading, reload } = useApi('/api/admin/knowledge');
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');

  async function save() {
    try {
      const body = { title: edit.title, body: edit.body, tags: edit.tags };
      if (edit.id) await api(`/api/admin/knowledge/${edit.id}`, { method: 'PUT', body });
      else await api('/api/admin/knowledge', { method: 'POST', body });
      setEdit(null); setErr(''); reload();
    } catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this article? The AI will stop using it immediately.')) return;
    try { await api(`/api/admin/knowledge/${id}`, { method: 'DELETE' }); reload(); } catch (e) { setErr(e.message); }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3">Knowledge base</Typography>
          <Typography color="text.secondary">What the AI answers general questions from: fees, limits, hours, how-tos. Edits take effect on the next chat message.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEdit({ ...empty })} sx={{ flexShrink: 0, ml: 2 }}>Add article</Button>
      </Stack>
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>Add what customers ask most: prices, opening hours, policies and how-tos. The AI answers only from what is written here.</Alert>
      <ApiError error={error} />
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {loading && !data ? <Loading /> : (
        <Stack spacing={2}>
          {data?.map((a) => (
            <Card key={a.id}><CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" sx={{ mb: .5 }}>{a.title}</Typography>
                  <Typography sx={{ fontSize: 14.5, color: tk.n700, mb: 1 }}>{a.body}</Typography>
                  <Stack direction="row" gap={.5} flexWrap="wrap">{a.tags.split(/\s+/).filter(Boolean).slice(0, 8).map((t) => <Chip key={t} size="small" label={t} sx={{ bgcolor: tk.n100, height: 22 }} />)}</Stack>
                </Box>
                <Stack direction="row" sx={{ flexShrink: 0 }}>
                  <IconButton aria-label="Edit" onClick={() => setEdit(a)}><EditOutlinedIcon fontSize="small" /></IconButton>
                  <IconButton aria-label="Delete" onClick={() => remove(a.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
            </CardContent></Card>
          ))}
        </Stack>
      )}
      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>{edit?.id ? 'Edit article' : 'New article'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" value={edit?.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} fullWidth required />
            <TextField label="Answer the AI should give" value={edit?.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} fullWidth required multiline minRows={4} />
            <TextField label="Keywords (space separated)" value={edit?.tags ?? ''} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} fullWidth helperText="Help the search match how customers phrase things" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="contained" onClick={save} disabled={!edit?.title?.trim() || !edit?.body?.trim()}>Save</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
