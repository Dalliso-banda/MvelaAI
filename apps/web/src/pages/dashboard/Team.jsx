import { useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip, Alert, MenuItem, Select, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockResetIcon from '@mui/icons-material/LockReset';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { tk } from '../../theme';
import { api, useApi } from '../../api';
import { useAuth } from '../../auth';
import { ApiError, Loading } from '../../components/ApiState';

const RANK = { agent: 1, admin: 2, owner: 3 };
const ROLE_HELP = { owner: 'Everything', admin: 'Everything except changing roles', agent: 'Conversations and escalations only' };

export default function Team() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/api/admin/team');
  const [add, setAdd] = useState(null);
  const [shown, setShown] = useState(null); // { name, tempPassword }
  const [err, setErr] = useState('');

  async function create() {
    try { const r = await api('/api/admin/team', { method: 'POST', body: add }); setShown({ name: r.user.name, email: r.user.email, tempPassword: r.tempPassword }); setAdd(null); setErr(''); reload(); }
    catch (e) { setErr(e.message); }
  }
  async function reset(m) {
    if (!window.confirm(`Reset the password for ${m.name}? Their current password stops working.`)) return;
    try { const r = await api(`/api/admin/team/${m.id}/reset-password`, { method: 'POST' }); setShown({ name: m.name, email: m.email, tempPassword: r.tempPassword }); } catch (e) { setErr(e.message); }
  }
  async function remove(m) {
    if (!window.confirm(`Remove ${m.name}? They are signed out immediately.`)) return;
    try { await api(`/api/admin/team/${m.id}`, { method: 'DELETE' }); reload(); } catch (e) { setErr(e.message); }
  }
  async function setRole(m, role) {
    try { await api(`/api/admin/team/${m.id}`, { method: 'PATCH', body: { role } }); reload(); } catch (e) { setErr(e.message); }
  }
  const myRank = RANK[user?.role] || 0;
  const roles = Object.keys(RANK).filter((r) => RANK[r] < myRank);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3">Team</Typography>
          <Typography color="text.secondary">People who can sign in to your company's dashboard.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setErr(''); setAdd({ name: '', email: '', role: roles[0] || 'agent' }); }} sx={{ flexShrink: 0, ml: 2 }}>Add person</Button>
      </Stack>
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>Owner: everything. Admin: everything except changing roles. Agent: conversations and escalations only. A new person gets a one-time password shown once; ask them to change it in Settings after signing in.</Alert>
      <ApiError error={error} />
      {err && !add && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {loading && !data ? <Loading /> : (
        <Stack spacing={1.5}>
          {data?.map((m) => {
            const mine = m.id === user?.id, canManage = !mine && RANK[m.role] < myRank;
            return (
              <Card key={m.id}><CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{m.name} {mine && <Chip size="small" label="You" sx={{ ml: 1, height: 20 }} />}</Typography>
                    <Typography sx={{ fontSize: 13.5, color: tk.n500 }}>{m.email}</Typography>
                  </Box>
                  {user?.role === 'owner' && canManage ? (
                    <Select size="small" value={m.role} onChange={(e) => setRole(m, e.target.value)} sx={{ minWidth: 110 }}>
                      <MenuItem value="admin">Admin</MenuItem><MenuItem value="agent">Agent</MenuItem>
                    </Select>
                  ) : <Chip label={m.role} size="small" sx={{ textTransform: 'capitalize', bgcolor: tk.n100 }} />}
                  {canManage && <>
                    <Tooltip title="Reset password"><IconButton aria-label="Reset password" onClick={() => reset(m)}><LockResetIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Remove"><IconButton aria-label="Remove" onClick={() => remove(m)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                  </>}
                </Stack>
              </CardContent></Card>
            );
          })}
        </Stack>
      )}

      <Dialog open={Boolean(add)} onClose={() => setAdd(null)} fullWidth maxWidth="xs">
        <DialogTitle>Add a person</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {err && <Alert severity="error">{err}</Alert>}
            <TextField label="Name" value={add?.name ?? ''} onChange={(e) => setAdd({ ...add, name: e.target.value })} fullWidth required />
            <TextField label="Email" type="email" value={add?.email ?? ''} onChange={(e) => setAdd({ ...add, email: e.target.value })} fullWidth required />
            <TextField select label="Role" value={add?.role ?? 'agent'} onChange={(e) => setAdd({ ...add, role: e.target.value })} helperText={ROLE_HELP[add?.role]} fullWidth>
              {roles.map((r) => <MenuItem key={r} value={r} sx={{ textTransform: 'capitalize' }}>{r}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setAdd(null)}>Cancel</Button><Button variant="contained" onClick={create} disabled={!add?.name?.trim() || !add?.email?.trim()}>Add</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(shown)} onClose={() => setShown(null)} fullWidth maxWidth="xs">
        <DialogTitle>One-time password</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>Give this to {shown?.name} ({shown?.email}). It is shown only once.</Typography>
          <Box sx={{ p: 2, bgcolor: tk.n100, borderRadius: 2, fontFamily: 'monospace', fontSize: 18, letterSpacing: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {shown?.tempPassword}
            <IconButton aria-label="Copy" onClick={() => { try { navigator.clipboard.writeText(shown.tempPassword); } catch { /* user can select the text */ } }}><ContentCopyIcon fontSize="small" /></IconButton>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="contained" onClick={() => setShown(null)}>Done</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
