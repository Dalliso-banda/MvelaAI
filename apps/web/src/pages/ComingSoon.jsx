import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';

export default function ComingSoon({ title }) {
  return (
    <Box sx={{ py: 12, textAlign: 'center' }}>
      <Typography variant="h3" gutterBottom>{title}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>It is part of the next build phase.</Typography>
      <Button component={Link} to="/" variant="contained">Back to home</Button>
    </Box>
  );
}
