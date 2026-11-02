import { Box, Typography, Button, Stack } from '@mui/material';
import { Link } from 'react-router-dom';
import { tk } from '../theme';

export const wrap = { maxWidth: 1200, mx: 'auto', px: { xs: 2.5, md: 5 } };

export default function PageHero({ title, body, cta = 'Request a demo', to = '/contact' }) {
  return (
    <Box sx={{ bgcolor: tk.subtle, py: { xs: 6, md: 9 } }}>
      <Box sx={wrap}>
        <Typography variant="h1" sx={{ maxWidth: 760, fontSize: { xs: '2.25rem', md: '3rem' } }}>{title}</Typography>
        <Typography sx={{ mt: 2, fontSize: 18, color: tk.n700, maxWidth: 640 }}>{body}</Typography>
        {cta && <Stack direction="row" sx={{ mt: 3.5 }}><Button component={Link} to={to} variant="contained" size="large">{cta}</Button></Stack>}
      </Box>
    </Box>
  );
}
