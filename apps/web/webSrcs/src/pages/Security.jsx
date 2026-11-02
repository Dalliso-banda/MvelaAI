import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PageHero, { wrap } from '../components/PageHero';
import { tk } from '../theme';

const items = [
  ['Data protection principles', 'We collect only what is needed to answer a customer and keep it for as long as your policy allows.'],
  ['Workspace separation', 'Each business has its own workspace, knowledge base and settings.'],
  ['Access control', 'Role-based permissions decide who can view conversations, edit knowledge and change AI settings.'],
  ['Knowledge base permissions', 'The assistant answers only from the documents your business has approved.'],
  ['Conversation handling', 'Conversations are logged for review and dispute handling, subject to your retention policy.'],
  ['AI limits and human oversight', 'The assistant says when it cannot find a reliable answer and offers a human agent.'],
  ['Security contact', 'Report a concern to our team through the contact page.'],
];

export default function Security() {
  return (
    <>
      <PageHero title="Customer trust starts with responsible AI." body="Mvela AI keeps your knowledge, permissions and human oversight at the centre of every customer conversation." cta="Talk to our team" />
      <Box sx={{ ...wrap, py: { xs: 8, md: 10 } }}>
        <Grid container spacing={3}>
          {items.map(([t, d]) => (
            <Grid item xs={12} sm={6} md={4} key={t}>
              <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
                <ShieldOutlinedIcon sx={{ color: tk.tealDark, mb: 1.5 }} />
                <Typography variant="h5" gutterBottom>{t}</Typography>
                <Typography color="text.secondary">{d}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
        <Typography sx={{ mt: 4, fontSize: 14, color: tk.n500, maxWidth: 680 }}>Security features are listed as product capabilities only once they are confirmed in the implementation. This prototype uses synthetic data only.</Typography>
      </Box>
    </>
  );
}
