import { useState } from 'react';
import { Box, Typography, Grid, TextField, MenuItem, Button, Alert, Stack } from '@mui/material';
import { wrap } from '../components/PageHero';
import { tk } from '../theme';
import { api } from '../api';

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr('');
    try {
      await api('/api/contact', { method: 'POST', body: { name: f.get('name'), email: f.get('email'), business: f.get('business'), industry: f.get('industry'), agents: f.get('agents'), contactMethod: f.get('contactMethod'), message: f.get('message') } });
      setSent(true);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ bgcolor: tk.subtle, py: { xs: 6, md: 9 } }}>
      <Box sx={wrap}>
        <Grid container spacing={6}>
          <Grid item xs={12} md={5}>
            <Typography variant="h1" sx={{ fontSize: { xs: '2.25rem', md: '2.75rem' } }}>Let's make customer service work better.</Typography>
            <Typography sx={{ mt: 2, fontSize: 17, color: tk.n700 }}>Tell us a little about your business. We'll help you explore how Mvela AI could fit into your support workflow.</Typography>
            <Typography sx={{ mt: 3, color: tk.n500 }}>Dalitso Banda, Founder<br />Dalitsofernandobanda@gmail.com<br />+260 976 557 875</Typography>
          </Grid>
          <Grid item xs={12} md={7}>
            <Box sx={{ bgcolor: '#fff', border: `1px solid ${tk.n200}`, borderRadius: 3, p: { xs: 2.5, md: 4 } }}>
              {sent ? (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  <strong>Thank you for your interest.</strong> Your demo request has been received. Our team will be in touch.
                </Alert>
              ) : (
                <Box component="form" onSubmit={submit}>
                  <Stack spacing={2.5}>
                    <TextField name="name" label="Full name" required fullWidth />
                    <TextField name="email" label="Work email" type="email" required fullWidth />
                    <TextField name="business" label="Business name" required fullWidth />
                    <TextField select name="industry" label="Industry" defaultValue="Banking" fullWidth>
                      {['Banking', 'Telecom', 'SME', 'Other'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField name="agents" label="Number of support agents" type="number" fullWidth />
                    <TextField select name="contactMethod" label="Preferred contact method" defaultValue="Email" fullWidth>
                      {['Email', 'Phone', 'WhatsApp'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField name="message" label="What would you like to improve? (optional)" multiline minRows={3} fullWidth />
                    {err && <Alert severity="error" sx={{ borderRadius: 2 }}>{err}</Alert>}
                    <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Sending…' : 'Request a demo'}</Button>
                  </Stack>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
