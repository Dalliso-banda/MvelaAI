import { Box, Typography, Alert, Grid, Card, CardContent, Chip, LinearProgress, Stack, Table, TableHead, TableRow, TableCell, TableBody, Button } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { tk } from '../../theme';

const metrics = [
  ['Conversations', '1,248', ChatBubbleOutlineIcon, tk.primary],
  ['AI resolution rate', '72%', SmartToyOutlinedIcon, tk.tealDark],
  ['Response time', '8 sec', TimerOutlinedIcon, tk.primary],
  ['Hours saved', '186 hrs', ScheduleOutlinedIcon, tk.tealDark],
];
const langs = [['English', 58, tk.primary], ['Bemba', 24, tk.teal], ['Nyanja', 18, tk.navy]];
const recent = [
  ['Customer 001', 'Product enquiry', 'English', 'AI resolved', 'success'],
  ['Customer 002', 'Service question', 'Bemba', 'Escalated', 'warning'],
  ['Customer 003', 'Account guidance', 'Nyanja', 'Human resolved', 'default'],
];

export default function Overview() {
  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3">Overview</Typography>
          <Typography color="text.secondary">Here's how your customer service is performing.</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}><Button variant="outlined">Last 7 days</Button><Button variant="outlined">Export report</Button></Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>Demo estimates.</strong> These figures are illustrative and do not represent actual customer conversations or verified business performance.
      </Alert>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {metrics.map(([t, v, I, c]) => (
          <Grid item xs={12} sm={6} lg={3} key={t}>
            <Card><CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 14 }}>{t}</Typography><I sx={{ color: c }} fontSize="small" /></Stack>
              <Typography sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.25, my: .5 }}>{v}</Typography>
              <Chip label="Demo estimate" size="small" sx={{ bgcolor: tk.n100, color: tk.n700, height: 22 }} />
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2.5 }}>Language distribution</Typography>
            <Stack spacing={2.5}>
              {langs.map(([l, p, c]) => (
                <Box key={l}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: .75 }}><Typography sx={{ fontSize: 14 }}>{l}</Typography><Typography sx={{ fontSize: 14, fontWeight: 600 }}>{p}%</Typography></Stack>
                  <LinearProgress variant="determinate" value={p} sx={{ height: 8, borderRadius: 4, bgcolor: tk.n100, '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 4 } }} />
                </Box>
              ))}
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>Recent activity</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow sx={{ bgcolor: tk.n50 }}>{['Customer', 'Topic', 'Language', 'Outcome'].map((h) => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {recent.map(([a, b, c, d, col]) => (
                    <TableRow key={a} hover sx={{ height: 56 }}>
                      <TableCell>{a}</TableCell><TableCell>{b}</TableCell><TableCell>{c}</TableCell>
                      <TableCell><Chip label={d} size="small" color={col} variant={col === 'default' ? 'outlined' : 'filled'} sx={{ height: 24 }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  );
}
