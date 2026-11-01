import { useState } from 'react';
import { Box, Typography, Grid, TextField, MenuItem, Button, Alert, Stack } from '@mui/material';
import { wrap } from '../components/PageHero';
import { tk } from '../theme';

export default function Contact() {
  const [sent, setSent] = useState(false);
  const submit = (e) => { e.preventDefault(); setSent(true); };
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
                    <TextField label="Full name" required fullWidth />
                    <TextField label="Work email" type="email" required fullWidth />
                    <TextField label="Business name" required fullWidth />
                    <TextField select label="Industry" defaultValue="Banking" fullWidth>
                      {['Banking', 'Telecom', 'SME', 'Other'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField label="Number of support agents" type="number" fullWidth />
                    <TextField select label="Preferred contact method" defaultValue="Email" fullWidth>
                      {['Email', 'Phone', 'WhatsApp'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField label="What would you like to improve? (optional)" multiline minRows={3} fullWidth />
                    <Button type="submit" variant="contained" size="large">Request a demo</Button>
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
