import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, AppBar, Toolbar, IconButton, InputBase, Avatar, Typography, Badge, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import Logo from '../components/Logo';
import { useAuth } from '../auth';
import { tk } from '../theme';

const W = 248;
const nav = [
  ['Overview', '/app', SpaceDashboardOutlinedIcon], ['Live demo', '/app/demo', PlayCircleOutlineIcon], ['Publish widget', '/app/widget', CodeOutlinedIcon], ['Conversations', '/app/conversations', ChatBubbleOutlineIcon],
  ['Escalation queue', '/app/escalations', SupportAgentOutlinedIcon], ['Knowledge base', '/app/knowledge', MenuBookOutlinedIcon], ['Lookups', '/app/connectors', HubOutlinedIcon],
  ['Industry packs', '/app/packs', ExtensionOutlinedIcon], ['AI settings', '/app/ai-settings', TuneOutlinedIcon],
  ['Team', '/app/team', GroupOutlinedIcon], ['Settings', '/app/settings', SettingsOutlinedIcon],
];

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <Box sx={{ bgcolor: tk.navy, height: '100%', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2.5, height: 64, display: 'flex', alignItems: 'center' }}><Link to="/" style={{ textDecoration: 'none' }}><Logo light /></Link></Box>
      <List sx={{ px: 1.5, flex: 1 }}>
        {nav.map(([t, to, I]) => (
          <ListItemButton key={to} component={NavLink} to={to} end={to === '/app'} onClick={onNavigate}
            sx={{ borderRadius: 2, mb: .5, color: '#CBD5E1', minHeight: 44,
              '&:hover': { bgcolor: 'rgba(255,255,255,.08)' },
              '&.active': { bgcolor: tk.primary, color: '#fff' } }}>
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><I fontSize="small" /></ListItemIcon>
            <ListItemText primary={t} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderTop: '1px solid #26364F' }}>
        <Avatar sx={{ bgcolor: tk.teal, width: 36, height: 36 }}>{(user?.name || '?').slice(0, 2).toUpperCase()}</Avatar>
        <Box><Typography sx={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</Typography><Typography sx={{ fontSize: 12, color: '#94A3B8' }}>{user?.email}</Typography></Box>
        <IconButton onClick={logout} aria-label="Sign out" sx={{ ml: 'auto', color: '#CBD5E1' }}><LogoutIcon fontSize="small" /></IconButton>
      </Box>
    </Box>
  );
}

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: tk.n50 }}>
      {desktop ? (
        <Drawer variant="permanent" PaperProps={{ sx: { width: W, border: 0 } }} sx={{ width: W, flexShrink: 0 }}>
          <SidebarContent />
        </Drawer>
      ) : (
        <Drawer open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: W } }}>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </Drawer>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: `1px solid ${tk.n200}`, bgcolor: '#fff' }}>
          <Toolbar sx={{ height: 64, gap: 1.5 }}>
            {!desktop && <IconButton onClick={() => setOpen(true)} aria-label="Open navigation"><MenuIcon /></IconButton>}
            <Typography sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>Demo workspace</Typography>
            <Box sx={{ flex: 1, maxWidth: 420, ml: { sm: 3 }, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, height: 40, border: `1px solid ${tk.n200}`, borderRadius: 2, bgcolor: tk.n50 }}>
              <SearchIcon fontSize="small" sx={{ color: tk.n500 }} />
              <InputBase placeholder="Search conversations, documents" sx={{ flex: 1, fontSize: 14 }} inputProps={{ 'aria-label': 'Search' }} />
            </Box>
            <Box sx={{ flex: 1 }} />
            <IconButton aria-label="Notifications"><Badge color="error" variant="dot"><NotificationsNoneOutlinedIcon /></Badge></IconButton>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280 }}><Outlet /></Box>
      </Box>
    </Box>
  );
}
