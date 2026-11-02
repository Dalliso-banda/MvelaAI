import { Box, Typography, Grid, Card, CardContent, Button, Stack } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { Link } from 'react-router-dom';
import PageHero, { wrap } from '../components/PageHero';
import { tk } from '../theme';

const plans = [
  ['Starter', 'For small businesses getting started.', ['AI chat', 'Knowledge base', 'Basic analytics', 'Email support'], 'Contact us', false],
  ['Business', 'For growing customer support teams.', ['AI chat and voice', 'Human handover', 'Team dashboard', 'Advanced analytics'], 'Request a demo', true],
  ['Enterprise', 'For banks, telecoms and large organisations.', ['Everything in Business', 'Custom industry packs', 'Security review support', 'Dedicated onboarding'], 'Talk to our team', false],
];

export default function Pricing() {
  return (
    <>
      <PageHero title="Simple plans for better customer support." body="Choose a plan that fits your business and your support needs." cta={null} />
      <Box sx={{ ...wrap, py: { xs: 8, md: 10 } }}>
        <Grid container spacing={3} alignItems="stretch">
          {plans.map(([n, d, f, c, hl]) => (
            <Grid item xs={12} md={4} key={n}>
              <Card sx={{ height: '100%', borderWidth: hl ? 2 : 1, borderColor: hl ? tk.primary : tk.n200 }}><CardContent sx={{ p: 3.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Typography variant="h5">{n}</Typography>
                <Typography variant="h3" sx={{ my: 1 }}>Pricing TBD</Typography>
                <Typography color="text.secondary" sx={{ mb: 2.5 }}>{d}</Typography>
                <Stack spacing={1.25} sx={{ flex: 1, mb: 3 }}>
                  {f.map((x) => <Stack key={x} direction="row" spacing={1} alignItems="center"><CheckIcon fontSize="small" sx={{ color: tk.tealDark }} /><Typography sx={{ fontSize: 15 }}>{x}</Typography></Stack>)}
                </Stack>
                <Button component={Link} to="/contact" variant={hl ? 'contained' : 'outlined'} size="large" fullWidth>{c}</Button>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
        <Typography sx={{ mt: 3, fontSize: 14, color: tk.n500 }}>Prices will be shown in ZMW once approved.</Typography>
      </Box>
    </>
  );
}
