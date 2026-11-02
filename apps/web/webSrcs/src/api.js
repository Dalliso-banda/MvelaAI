import { useCallback, useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  try { const t = localStorage.getItem('mvela_token'); if (t) headers.authorization = `Bearer ${t}`; } catch { /* storage unavailable */ }
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && (path.startsWith('/api/admin') || path === '/api/auth/me')) {
    try { localStorage.removeItem('mvela_token'); } catch { /* ignore */ }
    if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function useApi(path, { poll = 0 } = {}) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    try { set({ data: await api(path), error: null, loading: false }); }
    catch (e) { set((s) => ({ ...s, error: e.message, loading: false })); }
  }, [path]);
  useEffect(() => {
    set((s) => ({ ...s, loading: true }));
    load();
    if (!poll) return undefined;
    const t = setInterval(load, poll);
    return () => clearInterval(t);
  }, [load, poll]);
  return { ...state, reload: load };
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
