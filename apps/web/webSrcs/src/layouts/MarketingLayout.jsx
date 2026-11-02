import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { AppBar, Toolbar, Box, Button, IconButton, Drawer, List, ListItemButton, ListItemText, Typography, Grid } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import Logo from '../components/Logo';
import { tk } from '../theme';

const links = [['Home', '/'], ['How it works', '/how-it-works'], ['Industry packs', '/industries'], ['Security', '/security'], ['Pricing', '/pricing']];
const footer = {
  Product: ['How it works', 'Dashboard', 'AI agent'],
  Solutions: ['Banking', 'Telecom', 'SME'],
  Company: ['About', 'Contact', 'Request a demo'],
  Resources: ['Security', 'Privacy', 'Terms'],
};
const wrap = { maxWidth: 1200, mx: 'auto', px: { xs: 2.5, md: 5 } };

export default function MarketingLayout() {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: `1px solid ${tk.n200}`, bgcolor: 'rgba(255,255,255,.96)' }}>
        <Toolbar disableGutters sx={{ ...wrap, width: '100%', height: { xs: 64, md: 76 }, justifyContent: 'space-between' }}>
          <Link to="/" aria-label="Mvela AI home" style={{ textDecoration: 'none' }}><Logo /></Link>
          <Box component="nav" sx={{ display: { xs: 'none', md: 'flex' }, gap: 4 }}>
            {links.map(([t, to]) => (
              <Typography key={to} component={NavLink} to={to} end
                sx={{ color: tk.n700, fontWeight: 500, fontSize: 15, textDecoration: 'none', '&:hover': { color: tk.primary }, '&.active': { color: tk.primary } }}>
                {t}
              </Typography>
            ))}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1.5 }}>
            <Button component={Link} to="/app" color="inherit">Sign in</Button>
            <Button component={Link} to="/contact" variant="contained">Request a demo</Button>
          </Box>
          <IconButton sx={{ display: { md: 'none' } }} onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon /></IconButton>
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: '100%' } }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo />
          <IconButton onClick={() => setOpen(false)} aria-label="Close menu"><CloseIcon /></IconButton>
        </Box>
        <List sx={{ px: 1 }}>
          {links.map(([t, to]) => (
            <ListItemButton key={to} component={Link} to={to} onClick={() => setOpen(false)} sx={{ minHeight: 56 }}>
              <ListItemText primary={t} primaryTypographyProps={{ fontWeight: 600, fontSize: 18 }} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ mt: 'auto', p: 2, display: 'grid', gap: 1.5 }}>
          <Button component={Link} to="/app" variant="outlined" size="large" onClick={() => setOpen(false)}>Sign in</Button>
          <Button component={Link} to="/contact" variant="contained" size="large" onClick={() => setOpen(false)}>Request a demo</Button>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}><Outlet /></Box>

      <Box component="footer" sx={{ bgcolor: tk.navy, color: '#CBD5E1', pt: 8, pb: 4 }}>
        <Box sx={wrap}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Logo light />
              <Typography sx={{ mt: 2, maxWidth: 280, fontSize: 14 }}>Customer service that understands.</Typography>
            </Grid>
            {Object.entries(footer).map(([h, items]) => (
              <Grid item xs={6} md={2} key={h}>
                <Typography sx={{ color: '#fff', fontWeight: 600, mb: 1.5 }}>{h}</Typography>
                {items.map((i) => <Typography key={i} sx={{ fontSize: 14, py: 0.5 }}>{i}</Typography>)}
              </Grid>
            ))}
          </Grid>
          <Typography sx={{ mt: 6, pt: 3, borderTop: '1px solid #26364F', fontSize: 13 }}>
            © 2026 Mvela AI. Built for businesses in Zambia.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
