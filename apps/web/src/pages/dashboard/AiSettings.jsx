import { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, TextField, Button, Alert, MenuItem } from '@mui/material';
import { api, useApi } from '../../api';
import { ApiError, Loading } from '../../components/ApiState';

const TONES = [['friendly', 'Friendly and warm'], ['formal', 'Formal and polite'], ['concise', 'Brief and to the point']];

export default function AiSettings() {
  const { data, error, loading } = useApi('/api/admin/ai-settings');
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (data) setF(data); }, [data]);

  async function save() {
    setMsg(null);
    try { setF(await api('/api/admin/ai-settings', { method: 'PUT', body: f })); setMsg({ t: 'success', m: 'Saved. It applies from the next message.' }); }
    catch (e) { setMsg({ t: 'error', m: e.message }); }
  }
  return (
    <Box>
      <Typography variant="h3">AI settings</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Choose how your assistant sounds. What it knows comes from your Knowledge base and Lookups.</Typography>
      <ApiError error={error} />
      {loading && !f ? <Loading /> : f && (
        <Card sx={{ maxWidth: 640 }}><CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            {msg && <Alert severity={msg.t} onClose={() => setMsg(null)}>{msg.m}</Alert>}
            <TextField label="Assistant name" value={f.aiName} onChange={(e) => setF({ ...f, aiName: e.target.value })} helperText="Optional, e.g. Zuri. Leave blank to use your company name." inputProps={{ maxLength: 40 }} fullWidth />
            <TextField select label="Tone" value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} fullWidth>
              {TONES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
            <TextField label="Notes for the assistant" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} multiline minRows={4} fullWidth inputProps={{ maxLength: 1000 }}
              helperText={`Optional. For example: "We are a hardware store in Lusaka. Mention that we deliver within Lusaka for K50." (${f.notes.length}/1000)`} />
            <Alert severity="info" sx={{ borderRadius: 2 }}>These notes change wording and tone only. They cannot switch off safety rules such as never sharing secrets, answering only from your information, and handing over to a person when needed.</Alert>
            <Box><Button variant="contained" onClick={save}>Save</Button></Box>
          </Stack>
        </CardContent></Card>
      )}
    </Box>
  );
}
