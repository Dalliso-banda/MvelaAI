import { useState } from 'react';
import { Box, Typography, Card, Stack, TextField, MenuItem, Table, TableHead, TableRow, TableCell, TableBody, Drawer, IconButton, Divider, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { tk } from '../../theme';
import { useApi, timeAgo } from '../../api';
import { ApiError, Loading } from '../../components/ApiState';
import StatusChip from '../../components/StatusChip';

function Detail({ id, onClose }) {
  const { data: c, error } = useApi(`/api/admin/conversations/${id}`);
  return (
    <Box sx={{ width: { xs: '100vw', sm: 480 }, p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Conversation</Typography>
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </Stack>
      <ApiError error={error} />
      {!c ? <Loading /> : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <StatusChip status={c.status} /><Chip size="small" label={c.customer} variant="outlined" /><Chip size="small" label={c.language} variant="outlined" /><Chip size="small" label={c.topic} variant="outlined" />
            {c.source === 'seed' && <Chip size="small" label="Sample data" sx={{ bgcolor: tk.n100 }} />}
          </Stack>
          <Typography variant="h5" sx={{ mb: 1 }}>Transcript</Typography>
          <Stack spacing={1} sx={{ mb: 3 }}>
            {c.messages.map((m, i) => (
              <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: m.role === 'customer' ? tk.tint : tk.n50, border: `1px solid ${tk.n200}` }}>
                <Typography sx={{ fontSize: 12, color: tk.n500, mb: .25 }}>{m.role === 'customer' ? 'Customer' : 'Mvela AI'}{m.latencyMs ? ` · ${(m.latencyMs / 1000).toFixed(1)}s` : ''}</Typography>
                <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
              </Box>
            ))}
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 1 }}>Audit log</Typography>
          {c.audit.length === 0 ? <Typography color="text.secondary" sx={{ fontSize: 14 }}>No audit entries (sample conversation).</Typography> : (
            <Stack spacing={.75}>
              {c.audit.map((a, i) => (
                <Typography key={i} sx={{ fontSize: 13, fontFamily: 'monospace', color: tk.n700 }}>
                  {new Date(a.createdAt).toLocaleTimeString()} · {a.actor} · {a.action}{a.detail?.tools?.length ? ` [${a.detail.tools.join(', ')}]` : ''}
                </Typography>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}

export default function Conversations() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const { data, error, loading } = useApi(`/api/admin/conversations?limit=100${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { poll: 10000 });
  return (
    <Box>
      <Typography variant="h3">Conversations</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Every chat, with its full transcript and audit trail.</Typography>
      <ApiError error={error} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search name, topic or message" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 280, bgcolor: '#fff' }} />
        <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180, bgcolor: '#fff' }} SelectProps={{ displayEmpty: true }}>
          <MenuItem value="">All outcomes</MenuItem><MenuItem value="ai_resolved">AI resolved</MenuItem><MenuItem value="escalated">Escalated</MenuItem><MenuItem value="human_resolved">Human resolved</MenuItem><MenuItem value="open">In progress</MenuItem>
        </TextField>
      </Stack>
      <Card sx={{ overflowX: 'auto' }}>
        {loading && !data ? <Loading /> : (
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: tk.n50 }}>{['Customer', 'Topic', 'Language', 'Messages', 'Outcome', 'Updated'].map((h) => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {(data || []).map((r) => (
                <TableRow key={r.id} hover onClick={() => setSel(r.id)} sx={{ cursor: 'pointer', height: 52 }}>
                  <TableCell>{r.customer}</TableCell><TableCell>{r.topic}</TableCell><TableCell>{r.language}</TableCell><TableCell>{r.messages}</TableCell>
                  <TableCell><StatusChip status={r.status} /></TableCell><TableCell sx={{ color: tk.n500, whiteSpace: 'nowrap' }}>{timeAgo(r.updated_at)}</TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && <TableRow><TableCell colSpan={6} sx={{ py: 5, textAlign: 'center', color: tk.n500 }}>Nothing matches.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
      <Drawer anchor="right" open={Boolean(sel)} onClose={() => setSel(null)}>{sel && <Detail id={sel} onClose={() => setSel(null)} />}</Drawer>
    </Box>
  );
}
