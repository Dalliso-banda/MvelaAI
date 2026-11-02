import { Box, Typography, Grid, Card, CardContent, Stack } from '@mui/material';
import PageHero, { wrap } from '../components/PageHero';
import { tk } from '../theme';

const journey = [
  ['Create your business workspace', ['Enter your business name', 'Choose an industry', 'Add contact details']],
  ['Add your knowledge', ['Upload PDF, DOCX and TXT files', 'Review indexing status', 'Test knowledge retrieval']],
  ['Configure your AI agent', ['Select English, Bemba and/or Nyanja', 'Set the greeting', 'Define when a human takes over']],
  ['Test and launch', ['Preview the customer chat', 'Try sample questions', 'Publish the website chat widget']],
];
const flows = [
  ['From knowledge to answers', ['Business documents', 'Knowledge retrieval', 'AI response', 'Customer']],
  ['Human handover', ['Customer question', 'AI detects uncertainty', 'Escalation summary', 'Human agent', 'Customer response']],
];

function Flow({ items }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
      {items.map((t, i) => (
        <Stack key={t} direction={{ xs: 'column', md: 'row' }} alignItems="center" spacing={1}>
          <Box sx={{ px: 2, py: 1.25, borderRadius: 2, bgcolor: i % 2 ? tk.tint : tk.primary, color: i % 2 ? tk.navy : '#fff', fontWeight: 600, fontSize: 14 }}>{t}</Box>
          {i < items.length - 1 && <Typography sx={{ color: tk.n500 }}>›</Typography>}
        </Stack>
      ))}
    </Stack>
  );
}

export default function HowItWorks() {
  return (
    <>
      <PageHero title="A smarter support experience, built around your business." body="Mvela AI turns your business knowledge into an assistant that answers questions, guides customers, and brings your team in when needed." />
      <Box sx={{ ...wrap, py: { xs: 8, md: 10 } }}>
        <Typography variant="h2" sx={{ mb: 4 }}>Set up in four steps</Typography>
        <Grid container spacing={3}>
          {journey.map(([t, pts], i) => (
            <Grid item xs={12} sm={6} md={3} key={t}>
              <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
                <Typography sx={{ color: tk.primary, fontWeight: 700, mb: 1 }}>Step {i + 1}</Typography>
                <Typography variant="h5" gutterBottom>{t}</Typography>
                {pts.map((p) => <Typography key={p} color="text.secondary" sx={{ fontSize: 15, py: .25 }}>{p}</Typography>)}
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      </Box>
      <Box sx={{ bgcolor: tk.subtle, py: { xs: 8, md: 10 } }}>
        <Box sx={wrap}>
          <Stack spacing={5}>
            {flows.map(([t, items]) => (<Box key={t}><Typography variant="h4" sx={{ mb: 2 }}>{t}</Typography><Flow items={items} /></Box>))}
          </Stack>
        </Box>
      </Box>
      <Box sx={{ ...wrap, py: { xs: 8, md: 10 } }}>
        <Typography variant="h2" gutterBottom>Safe actions only</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 680, mb: 3, fontSize: 17 }}>The agent can perform only actions your business has enabled and authorised. Sensitive financial actions require secure authentication and explicit confirmation.</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
          {['Create a support ticket', 'Collect a callback request', 'Check an approved public service status', 'Route a customer to a human agent'].map((a) => (
            <Box key={a} sx={{ px: 2, py: 1, border: `1px solid ${tk.n200}`, borderRadius: 2, fontSize: 14, fontWeight: 500 }}>{a}</Box>
          ))}
        </Stack>
      </Box>
    </>
  );
}
