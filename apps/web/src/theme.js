import { createTheme } from '@mui/material/styles';

export const tk = {
  primary: '#155EEF', primaryHover: '#124FCC', navy: '#0B1F44', tint: '#EAF2FF', subtle: '#F5F8FF',
  teal: '#13B8A6', tealDark: '#087F73', n50: '#F8FAFC', n100: '#F1F5F9', n200: '#E2E8F0',
  n500: '#64748B', n700: '#334155', n900: '#0F172A',
};

const display = '"DM Sans","Inter",system-ui,sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: tk.primary, dark: tk.primaryHover, light: tk.tint, contrastText: '#fff' },
    secondary: { main: tk.teal, dark: tk.tealDark },
    error: { main: '#B42318' }, warning: { main: '#B45309' }, success: { main: '#15803D' },
    background: { default: tk.n50, paper: '#fff' },
    text: { primary: tk.n900, secondary: tk.n500 },
    divider: tk.n200,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter",system-ui,sans-serif',
    h1: { fontFamily: display, fontWeight: 700, fontSize: '2.5rem', lineHeight: 1.15, color: tk.navy, letterSpacing: '-0.02em' },
    h2: { fontFamily: display, fontWeight: 700, fontSize: '2rem', lineHeight: 1.25, color: tk.navy, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.3, color: tk.navy },
    h4: { fontWeight: 600, fontSize: '1.375rem', lineHeight: 1.35, color: tk.navy },
    h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.45 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 8, minHeight: 40, paddingInline: 16 }, sizeLarge: { minHeight: 48 } } },
    MuiCard: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: { borderRadius: 12, borderColor: tk.n200 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
  },
});

theme.typography.h1[theme.breakpoints.up('md')] = { fontSize: '3.5rem', lineHeight: 1.12 };
theme.typography.h2[theme.breakpoints.up('md')] = { fontSize: '2.25rem' };

export default theme;
