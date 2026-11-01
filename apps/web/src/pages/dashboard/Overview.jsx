import { useState } from 'react';
import { Box, Typography, Alert, Grid, Card, CardContent, Chip, LinearProgress, Stack, Table, TableHead, TableRow, TableCell, TableBody, Button, ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import { Link } from 'react-router-dom';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { tk } from '../../theme';
import { api, useApi, timeAgo } from '../../api';
import { ApiError, Loading } from '../../components/ApiState';
import StatusChip from '../../components/StatusChip';

const LANG_COLOR = { English: tk.primary, Bemba: tk.teal, Nyanja: tk.navy };

async function exportCsv() {
  const rows = await api('/api/admin/conversations?limit=200');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['id,customer,topic,language,status,messages,created_at', ...rows.map((r) => [r.id, r.customer, r.topic, r.language, r.status, r.messages, r.created_at].map(esc).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'mvela-conversations.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Overview() {
  const [days, setDays] = useState(7);
  const { data: d, error, loading } = useApi(`/api/admin/overview?days=${days}`, { poll: 10000 });

  const metrics = d && [
    ['Conversations', d.conversations.toLocaleString(), ChatBubbleOutlineIcon, tk.primary, null],
    ['AI resolution rate', d.aiResolutionRate == null ? 'n/a' : `${d.aiResolutionRate}%`, SmartToyOutlinedIcon, tk.tealDark, null],
    ['Avg response time', d.avgResponseSeconds == null ? 'n/a' : `${d.avgResponseSeconds} sec`, TimerOutlinedIcon, tk.primary, null],
    ['Hours saved', `${d.hoursSaved} hrs`, ScheduleOutlinedIcon, tk.tealDark, d.hoursSavedBasis],
  ];

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3">Overview</Typography>
          <Typography color="text.secondary">Here's how your customer service is performing.</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <ToggleButtonGroup size="small" exclusive value={days} onChange={(_e, v) => v && setDays(v)} aria-label="Date range">
            <ToggleButton value={7} sx={{ px: 2 }}>7 days</ToggleButton>
            <ToggleButton value={30} sx={{ px: 2 }}>30 days</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" onClick={exportCsv}>Export CSV</Button>
        </Stack>
      </Stack>

      <ApiError error={error} />
      {d?.openEscalations > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} action={<Button component={Link} to="/app/escalations" size="small" color="inherit">Review</Button>}>
          {d.openEscalations} conversation{d.openEscalations > 1 ? 's' : ''} waiting for a human agent.
        </Alert>
      )}
      {d?.seededConversations > 0 && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }} action={<Button component={Link} to="/app/demo" size="small" color="inherit" sx={{ whiteSpace: 'nowrap' }}>Try the agent</Button>}>
          <strong>Synthetic data.</strong> {d.seededConversations} of these conversations are sample history seeded for the demo. Chats you run in the live demo appear here within seconds.
        </Alert>
      )}

      {loading && !d ? <Loading /> : d && (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {metrics.map(([t, v, I, c, note]) => (
              <Grid item xs={12} sm={6} lg={3} key={t}>
                <Card><CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 14 }}>{t}</Typography><I sx={{ color: c }} fontSize="small" /></Stack>
                  <Typography sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.25, my: .5 }}>{v}</Typography>
                  {note ? <Tooltip title={note}><Chip label="Estimate" size="small" sx={{ bgcolor: tk.n100, color: tk.n700, height: 22 }} /></Tooltip>
                    : <Chip label={`Last ${d.days} days`} size="small" sx={{ bgcolor: tk.n100, color: tk.n700, height: 22 }} />}
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={5}>
              <Stack spacing={2.5} sx={{ height: '100%' }}>
                <Card><CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ mb: 2.5 }}>Language distribution</Typography>
                  <Stack spacing={2.5}>
                    {d.languages.length === 0 && <Typography color="text.secondary">No conversations yet.</Typography>}
                    {d.languages.map((l) => (
                      <Box key={l.language}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: .75 }}><Typography sx={{ fontSize: 14 }}>{l.language}</Typography><Typography sx={{ fontSize: 14, fontWeight: 600 }}>{l.percent}%</Typography></Stack>
                        <LinearProgress variant="determinate" value={l.percent} sx={{ height: 8, borderRadius: 4, bgcolor: tk.n100, '& .MuiLinearProgress-bar': { bgcolor: LANG_COLOR[l.language] || tk.n500, borderRadius: 4 } }} />
                      </Box>
                    ))}
                  </Stack>
                </CardContent></Card>
                <Card><CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ mb: 2 }}>Top topics</Typography>
                  <Stack spacing={1.25}>
                    {d.topics.map((t) => (
                      <Stack key={t.topic} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 14 }}>{t.topic}</Typography><Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t.count}</Typography></Stack>
                    ))}
                  </Stack>
                </CardContent></Card>
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
                <Typography variant="h5" sx={{ mb: 1 }}>Recent activity</Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead><TableRow sx={{ bgcolor: tk.n50 }}>{['Customer', 'Topic', 'Language', 'Outcome', 'When'].map((h) => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow></TableHead>
                    <TableBody>
                      {d.recent.map((r) => (
                        <TableRow key={r.id} hover sx={{ height: 56 }}>
                          <TableCell>{r.customer}</TableCell><TableCell>{r.topic}</TableCell><TableCell>{r.language}</TableCell>
                          <TableCell><StatusChip status={r.status} /></TableCell>
                          <TableCell sx={{ color: tk.n500, whiteSpace: 'nowrap' }}>{timeAgo(r.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </CardContent></Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
