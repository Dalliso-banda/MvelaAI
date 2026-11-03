
import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';

import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  IconButton,
  InputBase,
  Avatar,
  Typography,
  Badge,
  useMediaQuery,
} from '@mui/material';

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
  ['Overview', '/app', SpaceDashboardOutlinedIcon],
  ['Live demo', '/app/demo', PlayCircleOutlineIcon],
  ['Publish widget', '/app/widget', CodeOutlinedIcon],
  ['Conversations', '/app/conversations', ChatBubbleOutlineIcon],
  ['Escalation queue', '/app/escalations', SupportAgentOutlinedIcon],
  ['Knowledge base', '/app/knowledge', MenuBookOutlinedIcon],
  ['Lookups', '/app/connectors', HubOutlinedIcon],
  ['AI settings', '/app/ai-settings', TuneOutlinedIcon],
  ['Team', '/app/team', GroupOutlinedIcon],
  ['Settings', '/app/settings', SettingsOutlinedIcon],
];

// Hide scrollbar visually while preserving scrolling.
const hideScrollbar = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': {
    display: 'none',
  },
};

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();

  return (
    <Box
      sx={{
        bgcolor: tk.navy,
        height: '100%',
        width: '100%',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          px: 2.5,
          height: 64,
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo light />
        </Link>
      </Box>

      {/* Navigation */}
      <List
        sx={{
          px: 1.5,
          py: 1,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          ...hideScrollbar,
        }}
      >
        {nav.map(([t, to, I]) => (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            end={to === '/app'}
            onClick={onNavigate}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: '#CBD5E1',
              minHeight: 44,
              transition: 'background-color .2s ease',

              '&:hover': {
                bgcolor: 'rgba(255,255,255,.08)',
              },

              '&.active': {
                bgcolor: tk.primary,
                color: '#fff',
              },

              '&.active:hover': {
                bgcolor: tk.primary,
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 36,
                color: 'inherit',
              }}
            >
              <I fontSize="small" />
            </ListItemIcon>

            <ListItemText
              primary={t}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: 500,
              }}
            />
          </ListItemButton>
        ))}
      </List>

      {/* User profile */}
      <Box
        sx={{
          p: 2,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderTop: '1px solid #26364F',
          bgcolor: tk.navy,
        }}
      >
        <Avatar
          sx={{
            bgcolor: tk.teal,
            width: 36,
            height: 36,
            fontSize: 13,
          }}
        >
          {(user?.name || '?').slice(0, 2).toUpperCase()}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            noWrap
            sx={{ fontSize: 14, fontWeight: 600 }}
          >
            {user?.name}
          </Typography>

          <Typography
            noWrap
            sx={{ fontSize: 12, color: '#94A3B8' }}
          >
            {user?.email}
          </Typography>
        </Box>

        <IconButton
          onClick={logout}
          aria-label="Sign out"
          size="small"
          sx={{ color: '#CBD5E1', flexShrink: 0 }}
        >
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);

  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const sidebar = (
    <SidebarContent
      onNavigate={() => setOpen(false)}
    />
  );

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100vh',
        height: '100dvh',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: tk.n50,
      }}
    >
      {/* Desktop sidebar */}
      {desktop ? (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: W,
              height: '100vh',
              height: '100dvh',
              position: 'fixed',
              top: 0,
              left: 0,
              border: 0,
              bgcolor: tk.navy,
              overflow: 'hidden',
            },
          }}
          sx={{
            width: W,
            flexShrink: 0,

            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
            },
          }}
        >
          {sidebar}
        </Drawer>
      ) : (
        /* Mobile sidebar */
        <Drawer
          variant="temporary"
          anchor="left"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
          PaperProps={{
            sx: {
              width: W,
              height: '100dvh',
              border: 0,
              bgcolor: tk.navy,
              overflow: 'hidden',
            },
          }}
        >
          {sidebar}
        </Drawer>
      )}

      {/* Main application area */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top navigation */}
        <AppBar
          position="static"
          color="inherit"
          elevation={0}
          sx={{
            flexShrink: 0,
            borderBottom: `1px solid ${tk.n200}`,
            bgcolor: '#FFFFFF',
            zIndex: theme.zIndex.appBar,
          }}
        >
          <Toolbar
            sx={{
              height: 64,
              minHeight: '64px !important',
              px: { xs: 2, md: 3 },
              gap: 1.5,
            }}
          >
            {!desktop && (
              <IconButton
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
                edge="start"
              >
                <MenuIcon />
              </IconButton>
            )}

            <Typography
              sx={{
                fontWeight: 600,
                fontSize: 14,
                display: { xs: 'none', sm: 'block' },
                whiteSpace: 'nowrap',
              }}
            >
              Demo workspace
            </Typography>

            {/* Search */}
            <Box
              sx={{
                flex: 1,
                maxWidth: 420,
                ml: { sm: 3 },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                height: 40,
                border: `1px solid ${tk.n200}`,
                borderRadius: 2,
                bgcolor: tk.n50,
                minWidth: 0,
              }}
            >
              <SearchIcon
                fontSize="small"
                sx={{ color: tk.n500, flexShrink: 0 }}
              />

              <InputBase
                placeholder="Search conversations, documents"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                }}
                inputProps={{
                  'aria-label': 'Search',
                }}
              />
            </Box>

            <Box sx={{ flex: 1 }} />

            <IconButton aria-label="Notifications">
              <Badge color="error" variant="dot">
                <NotificationsNoneOutlinedIcon />
              </Badge>
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Scrollable content - only this area scrolls */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: tk.n50,
            p: { xs: 2, sm: 3, md: 4 },
            ...hideScrollbar,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 1280,
              mx: 'auto',
              minWidth: 0,
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
