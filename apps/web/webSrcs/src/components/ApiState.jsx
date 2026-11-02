import { Alert, Box, CircularProgress } from '@mui/material';

export function ApiError({ error }) {
  if (!error) return null;
  return <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>Couldn't reach the API: {error}. Is <code>npm run dev</code> running?</Alert>;
}
export function Loading() {
  return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={28} /></Box>;
}
