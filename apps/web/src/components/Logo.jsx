import { Box, Typography } from '@mui/material';
import { tk } from '../theme';

export function LogoIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="17" fill={tk.primary} />
      <g stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
        <line x1="16" y1="28" x2="16" y2="36" /><line x1="25" y1="21" x2="25" y2="43" />
        <line x1="34" y1="14" x2="34" y2="50" /><line x1="43" y1="22" x2="43" y2="42" />
        <line x1="52" y1="28" x2="52" y2="36" />
      </g>
    </svg>
  );
}

export default function Logo({ light = false }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <LogoIcon />
      <Typography sx={{ fontWeight: 700, fontSize: 22, color: light ? '#fff' : tk.navy, letterSpacing: '-0.01em' }}>
        Mvela <Box component="span" sx={{ color: light ? '#7BA7FF' : tk.primary }}>AI</Box>
      </Typography>
    </Box>
  );
}
