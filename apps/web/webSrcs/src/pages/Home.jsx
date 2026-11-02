import { Box, Typography, Button, Grid, Card, CardContent, Chip, Stack } from '@mui/material';
import { Link } from 'react-router-dom';
import RepeatIcon from '@mui/icons-material/Repeat';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import CellTowerIcon from '@mui/icons-material/CellTower';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { tk } from '../theme';

const wrap = { maxWidth: 1200, mx: 'auto', px: { xs: 2.5, md: 5 } };

function Bubble({ who, children }) {
  const me = who === 'me';
  return (
    <Box sx={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
      {!me && <Chip label="AI assistant" size="small" sx={{ mb: 0.5, bgcolor: '#CCFBF1', color: '#115E59', height: 22 }} />}
      <Box sx={{ p: 1.5, borderRadius: '16px', fontSize: 15, bgcolor: me ? tk.primary : tk.n100, color: me ? '#fff' : tk.n900 }}>{children}</Box>
    </Box>
  );
}

function ChatMock() {
  return (
    <Card sx={{ maxWidth: 400, ml: { md: 'auto' }, boxShadow: '0 12px 32px rgba(15,23,42,.12)', borderRadius: 4 }}>
      <Box sx={{ bgcolor: tk.primary, color: '#fff', p: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>Customer Support</Typography>
        <Typography sx={{ fontSize: 13, opacity: .9 }}>Mvela AI assistant · Sample conversation</Typography>
      </Box>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Bubble>Hello! I can help with our services and opening hours. What would you like to know?</Bubble>
        <Bubble who="me">What time do you open on Saturdays?</Bubble>
        <Bubble>We open from 08:00 to 13:00 on Saturdays, according to the Customer FAQs.</Bubble>
        <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
          <Chip label="Talk to a person" variant="outlined" color="primary" />
          <Chip label="Ask another question" variant="outlined" />
        </Stack>
      </Stack>
    </Card>
  );
}

const problems = [
  [RepeatIcon, 'Repetitive questions', 'Your team spends hours answering the same questions about services, products, and policies.'],
  [AccessTimeIcon, 'Customers expect more', 'People want help when they need it, not only when your support team is available.'],
  [SavingsOutlinedIcon, 'Support gets expensive', 'Growing your business should not mean growing your support workload at the same rate.'],
];
const steps = [
  [UploadFileOutlinedIcon, 'Upload your knowledge', 'FAQs, policies, product guides, and support documents.'],
  [TuneOutlinedIcon, 'Configure your agent', 'Select your industry pack, languages, and support rules.'],
  [RocketLaunchOutlinedIcon, 'Launch your assistant', 'Add chat and browser-based voice support to your website.'],
  [VisibilityOutlinedIcon, 'Stay in control', 'Monitor conversations, review escalations, and improve your knowledge base.'],
];
const packs = [
  [AccountBalanceOutlinedIcon, 'Banking', 'Product FAQs, service guidance, and secure human escalation.'],
  [CellTowerIcon, 'Telecom', 'Bundles, network questions, mobile money guidance, and service support.'],
  [StorefrontOutlinedIcon, 'SME', 'Products, opening hours, orders, delivery, and callback requests.'],
];

function IconTile({ Icon }) {
  return <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: tk.tint, color: tk.primary, display: 'grid', placeItems: 'center', mb: 2 }}><Icon /></Box>;
}

export default function Home() {
  return (
    <>
      <Box sx={{ bgcolor: tk.subtle, py: { xs: 6, md: 10 } }}>
        <Box sx={wrap}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h1">Customer service that understands.</Typography>
              <Typography sx={{ mt: 2.5, fontSize: 18, color: tk.n700, maxWidth: 520 }}>
                Meet Mvela AI, your intelligent customer service centre, built for the way businesses in Zambia work. Answer questions, support multiple languages, and connect customers to your team when it matters.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
                <Button component={Link} to="/contact" variant="contained" size="large">Request a demo</Button>
                <Button component={Link} to="/how-it-works" variant="outlined" size="large">See how it works</Button>
              </Stack>
              <Typography sx={{ mt: 3, fontSize: 14, color: tk.n500 }}>Support in English, Bemba and Nyanja.</Typography>
            </Grid>
            <Grid item xs={12} md={6}><ChatMock /></Grid>
          </Grid>
        </Box>
      </Box>

      <Box sx={{ ...wrap, py: { xs: 8, md: 12 } }}>
        <Typography variant="h2" sx={{ maxWidth: 640, mb: 5 }}>Your customers need answers. Your team needs time.</Typography>
        <Grid container spacing={3}>
          {problems.map(([I, t, d]) => (
            <Grid item xs={12} md={4} key={t}>
              <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
                <IconTile Icon={I} /><Typography variant="h5" gutterBottom>{t}</Typography>
                <Typography color="text.secondary">{d}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ bgcolor: tk.navy, py: { xs: 8, md: 12 } }}>
        <Box sx={wrap}>
          <Typography variant="h2" sx={{ color: '#fff', maxWidth: 640, mb: 5 }}>From your documents to a smarter support experience.</Typography>
          <Grid container spacing={3}>
            {steps.map(([I, t, d], i) => (
              <Grid item xs={12} sm={6} md={3} key={t}>
                <Box sx={{ color: '#7BA7FF', mb: 1.5 }}><I fontSize="large" /></Box>
                <Typography sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>{i + 1}. {t}</Typography>
                <Typography sx={{ color: '#CBD5E1', fontSize: 15 }}>{d}</Typography>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      <Box sx={{ ...wrap, py: { xs: 8, md: 12 } }}>
        <Typography variant="h2" sx={{ mb: 5 }}>Built around the way your business works.</Typography>
        <Grid container spacing={3}>
          {packs.map(([I, t, d]) => (
            <Grid item xs={12} md={4} key={t}>
              <Card sx={{ height: '100%', '&:hover': { borderColor: tk.primary, bgcolor: tk.subtle } }}><CardContent sx={{ p: 3 }}>
                <IconTile Icon={I} /><Typography variant="h4" gutterBottom>{t}</Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>{d}</Typography>
                <Button component={Link} to="/industries" size="small">Explore {t}</Button>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ bgcolor: tk.subtle, py: { xs: 8, md: 10 } }}>
        <Box sx={wrap}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h2" gutterBottom>Support that speaks your customer's language.</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 17 }}>Whether your customer prefers English, Bemba, or Nyanja, Mvela AI helps make customer service more accessible. A language goes live only after its text and speech quality have been reviewed.</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1.5}>
                {[['English', 'Hello! How can I help you today?'], ['Bemba', 'Sample greeting, awaiting native review'], ['Nyanja', 'Sample greeting, awaiting native review']].map(([l, g]) => (
                  <Card key={l}><CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography sx={{ fontWeight: 600, color: tk.primary, fontSize: 14 }}>{l}</Typography>
                    <Typography>{g}</Typography>
                  </CardContent></Card>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Box>

      <Box sx={{ ...wrap, py: { xs: 8, md: 12 } }}>
        <Typography variant="h2" sx={{ mb: 5 }}>Your business stays in control.</Typography>
        <Grid container spacing={3}>
          {['Business-specific knowledge', 'Permission-based team access', 'Secure document management', 'Human escalation when needed'].map((t) => (
            <Grid item xs={12} sm={6} md={3} key={t}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <ShieldOutlinedIcon sx={{ color: tk.tealDark }} /><Typography sx={{ fontWeight: 600 }}>{t}</Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ bgcolor: tk.primary, py: { xs: 8, md: 10 }, textAlign: 'center' }}>
        <Box sx={wrap}>
          <Typography variant="h2" sx={{ color: '#fff' }}>Give your customers a better way to get help.</Typography>
          <Typography sx={{ color: '#EAF2FF', mt: 1.5, mb: 4 }}>See how Mvela AI could work for your business.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
            <Button component={Link} to="/contact" size="large" sx={{ bgcolor: '#fff', color: tk.primary, '&:hover': { bgcolor: tk.tint } }}>Request a demo</Button>
            <Button component={Link} to="/contact" size="large" sx={{ color: '#fff', border: '1px solid #fff' }}>Contact our team</Button>
          </Stack>
        </Box>
      </Box>
    </>
  );
}
