import { useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, Button, ToggleButtonGroup, ToggleButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip } from '@mui/material';
import { tk } from '../../theme';
import { api, useApi, timeAgo } from '../../api';
import { ApiError, Loading } from '../../components/ApiState';
import { PriorityChip } from '../../components/StatusChip';

export default function Escalations() {
  const [view, setView] = useState('open');
  const { data, error, loading, reload } = useApi(`/api/admin/escalations?status=${view}`, { poll: 8000 });
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  async function resolve() {
    try { await api(`/api/admin/escalations/${target.id}`, { method: 'PATCH', body: { note } }); setTarget(null); setNote(''); reload(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3">Escalation queue</Typography>
          <Typography color="text.secondary">Fraud, complaints, card requests and anything the AI shouldn't handle alone. High priority first.</Typography>
        </Box>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && setView(v)} aria-label="Filter">
          <ToggleButton value="open" sx={{ px: 2 }}>Open</ToggleButton><ToggleButton value="resolved" sx={{ px: 2 }}>Resolved</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <ApiError error={error} />
      {loading && !data ? <Loading /> : (
        <Stack spacing={2}>
          {data?.length === 0 && <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>{view === 'open' ? 'Nothing waiting. Nice.' : 'No resolved tickets yet.'}</Typography>}
          {data?.map((e) => (
            <Card key={e.id}><CardContent sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .75 }} flexWrap="wrap" useFlexGap>
                    <PriorityChip priority={e.priority} /><Typography sx={{ fontWeight: 600 }}>{e.customer}</Typography>
                    <Chip size="small" variant="outlined" label={e.language} /><Typography sx={{ fontSize: 13, color: tk.n500 }}>{timeAgo(e.createdAt)}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 14.5, mb: 1 }}>{e.reason}</Typography>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: tk.n50, border: `1px solid ${tk.n200}`, fontSize: 13, whiteSpace: 'pre-wrap', color: tk.n700, maxHeight: 130, overflow: 'auto' }}>{e.summary}</Box>
                  {e.note && <Typography sx={{ fontSize: 13, mt: 1, color: tk.tealDark }}>Resolution note: {e.note}</Typography>}
                </Box>
                {e.status === 'open' && <Button variant="contained" onClick={() => setTarget(e)} sx={{ alignSelf: 'flex-start', flexShrink: 0 }}>Mark resolved</Button>}
              </Stack>
            </CardContent></Card>
          ))}
        </Stack>
      )}
      <Dialog open={Boolean(target)} onClose={() => setTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Resolve escalation</DialogTitle>
        <DialogContent>
          <TextField autoFocus multiline minRows={3} fullWidth label="What was done? (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
          {err && <Typography color="error" sx={{ mt: 1, fontSize: 14 }}>{err}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setTarget(null)}>Cancel</Button><Button variant="contained" onClick={resolve}>Resolve</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
