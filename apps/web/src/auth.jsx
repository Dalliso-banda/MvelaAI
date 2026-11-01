import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api';

const TOKEN = 'mvela_token';
const read = () => { try { return localStorage.getItem(TOKEN); } catch { return null; } };
const write = (t) => { try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch { /* storage unavailable */ } };

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!read());
  useEffect(() => {
    if (read()) api('/api/auth/me').then((d) => setUser(d.user)).catch(() => write(null)).finally(() => setReady(true));
  }, []);
  const value = {
    user, ready,
    login: async (email, password) => { const d = await api('/api/auth/login', { method: 'POST', body: { email, password } }); write(d.token); setUser(d.user); },
    logout: () => { write(null); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? children : <Navigate to="/login" replace />;
}
