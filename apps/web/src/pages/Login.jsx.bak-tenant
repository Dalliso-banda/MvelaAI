import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Box, Card, TextField, Button, Alert, Stack, Typography } from '@mui/material';
import Logo from '../components/Logo';
import { useAuth } from '../auth';
import { tk } from '../theme';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(f.email, f.password); nav('/app'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: tk.subtle, display: 'grid', placeItems: 'center', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}><Link to="/" style={{ textDecoration: 'none' }}><Logo /></Link></Box>
        <Card sx={{ p: 3.5 }}>
          <Typography variant="h3" sx={{ mb: 0.5 }}>Welcome back.</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Sign in to your dashboard.</Typography>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              {err && <Alert severity="error">{err}</Alert>}
              <TextField label="Email" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required fullWidth />
              <TextField label="Password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required fullWidth />
              <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            </Stack>
          </Box>
        </Card>
        <Typography sx={{ mt: 2, textAlign: 'center', fontSize: 14, color: tk.n500 }}>Accounts are created by the Mvela team for your business.</Typography>
      </Box>
    </Box>
  );
}
