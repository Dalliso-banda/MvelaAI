import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Card, TextField, Button, Alert, Stack, Typography } from '@mui/material';
import Logo from '../components/Logo';
import { api } from '../api';
import { tk } from '../theme';

export default function Signup() {
  const [f, setF] = useState({ company: '', name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const d = await api('/api/auth/signup', { method: 'POST', body: f });
      try { localStorage.setItem('mvela_token', d.token); } catch { /* storage unavailable */ }
      window.location.assign('/app/knowledge'); // full load so the signed-in state is picked up
    } catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: tk.subtle, display: 'grid', placeItems: 'center', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}><Link to="/" style={{ textDecoration: 'none' }}><Logo /></Link></Box>
        <Card sx={{ p: 3.5 }}>
          <Typography variant="h3" sx={{ mb: 0.5 }}>Create your company account.</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Teach the AI about your business, then add its chat to your website.</Typography>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              {err && <Alert severity="error">{err}</Alert>}
              <TextField label="Company name" value={f.company} onChange={set('company')} required fullWidth />
              <TextField label="Your name" autoComplete="name" value={f.name} onChange={set('name')} required fullWidth />
              <TextField label="Work email" type="email" autoComplete="username" value={f.email} onChange={set('email')} required fullWidth />
              <TextField label="Password" type="password" autoComplete="new-password" helperText="At least 8 characters" value={f.password} onChange={set('password')} required fullWidth />
              <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
            </Stack>
          </Box>
        </Card>
        <Typography sx={{ mt: 2, textAlign: 'center', fontSize: 14, color: tk.n500 }}>Already have an account? <Link to="/login">Sign in</Link></Typography>
      </Box>
    </Box>
  );
}
