import { Box, Typography, Grid, Stack, Alert } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PageHero, { wrap } from '../components/PageHero';
import { tk } from '../theme';

const packs = [
  { id: 'banking', name: 'Banking', head: 'Banking support that puts customers first.',
    body: 'Help customers understand your products, find service information, and get answers without waiting in a queue.',
    feats: ['Account and product FAQs', 'Branch and service information', 'Card and transaction support guidance', 'Secure human escalation', 'Approved banking policy retrieval'],
    note: 'The assistant never discloses balances, transactions or account details in an unauthenticated chat.', cta: 'Request a banking demo' },
  { id: 'telecom', name: 'Telecom', head: 'Better support for every connection.',
    body: 'Help customers find answers about bundles, network services, mobile money guidance, and account support.',
    feats: ['Bundle and tariff FAQs', 'Network troubleshooting', 'Service availability information', 'Mobile money guidance', 'Human handover'], cta: 'Request a telecom demo' },
  { id: 'sme', name: 'SME', head: 'Give your customers answers while you grow your business.',
    body: 'Answer product questions, explain services, and support customers around the clock.',
    feats: ['Product and service FAQs', 'Opening hours', 'Order and delivery guidance', 'Customer enquiries', 'Callback requests'], cta: 'Get started' },
];

export default function Industries() {
  return (
    <>
      <PageHero title="Built around the way your business works." body="Choose an industry pack and Mvela AI starts with the topics, safety rules and escalation paths that suit your customers." cta="Request a demo" />
      {packs.map((p, i) => (
        <Box key={p.id} id={p.id} sx={{ py: { xs: 7, md: 9 }, bgcolor: i % 2 ? tk.subtle : '#fff' }}>
          <Box sx={wrap}>
            <Grid container spacing={6}>
              <Grid item xs={12} md={6}>
                <Typography sx={{ color: tk.primary, fontWeight: 600, mb: 1 }}>{p.name}</Typography>
                <Typography variant="h2" gutterBottom>{p.head}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 17 }}>{p.body}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={1.5}>
                  {p.feats.map((f) => (
                    <Stack key={f} direction="row" spacing={1.5} alignItems="center">
                      <CheckCircleOutlineIcon sx={{ color: tk.tealDark }} /><Typography sx={{ fontWeight: 500 }}>{f}</Typography>
                    </Stack>
                  ))}
                </Stack>
                {p.note && <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>{p.note}</Alert>}
              </Grid>
            </Grid>
          </Box>
        </Box>
      ))}
    </>
  );
}
