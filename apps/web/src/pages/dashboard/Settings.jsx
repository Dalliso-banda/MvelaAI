import { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, TextField, Button, Alert } from '@mui/material';
import { api, useApi } from '../../api';
import { useAuth } from '../../auth';
import { ApiError, Loading } from '../../components/ApiState';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const { data, error, loading } = useApi(isAdmin ? '/api/admin/settings' : '/api/auth/me');
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState(null);
  useEffect(() => { if (data && isAdmin) setF(data); }, [data, isAdmin]);

  async function save() {
    setMsg(null);
    try { setF(await api('/api/admin/settings', { method: 'PUT', body: f })); setMsg({ t: 'success', m: 'Saved.' }); }
    catch (e) { setMsg({ t: 'error', m: e.message }); }
  }
  async function changePw() {
    setPwMsg(null);
    try { await api('/api/admin/account/password', { method: 'POST', body: pw }); setPw({ current: '', next: '' }); setPwMsg({ t: 'success', m: 'Password changed.' }); }
    catch (e) { setPwMsg({ t: 'error', m: e.message }); }
  }
  return (
    <Box>
      <Typography variant="h3">Settings</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Signed in as {user?.name} ({user?.email}), {user?.role}.</Typography>
      <ApiError error={error} />
      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        {isAdmin && (loading && !f ? <Loading /> : f && (
          <Card><CardContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>Company</Typography>
            <Stack spacing={2.5}>
              {msg && <Alert severity={msg.t} onClose={() => setMsg(null)}>{msg.m}</Alert>}
              <TextField label="Company name" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} helperText="Shown in the chat window and in greetings." fullWidth />
              <TextField label="Welcome message" value={f.welcome} onChange={(e) => setF({ ...f, welcome: e.target.value })} multiline minRows={2} fullWidth inputProps={{ maxLength: 300 }} helperText="The first thing visitors see. Leave blank for the default greeting." />
              <TextField label="Minutes a person would spend on a routine question" type="number" value={f.handleMinutes} onChange={(e) => setF({ ...f, handleMinutes: e.target.value })} helperText="Used only for the 'hours saved' estimate on the Overview page." fullWidth inputProps={{ min: 1, max: 120 }} />
              <Box><Button variant="contained" onClick={save}>Save</Button></Box>
            </Stack>
          </CardContent></Card>
        ))}
        <Card><CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Change your password</Typography>
          <Stack spacing={2.5}>
            {pwMsg && <Alert severity={pwMsg.t} onClose={() => setPwMsg(null)}>{pwMsg.m}</Alert>}
            <TextField label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} fullWidth />
            <TextField label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} helperText="At least 8 characters" fullWidth />
            <Box><Button variant="contained" onClick={changePw} disabled={!pw.current || pw.next.length < 8}>Change password</Button></Box>
          </Stack>
        </CardContent></Card>
      </Stack>
    </Box>
  );
}
