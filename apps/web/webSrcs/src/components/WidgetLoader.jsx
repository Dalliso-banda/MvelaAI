import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';

const IDS = ['mvela-widget-frame', 'mvela-widget-btn', 'mvela-widget-script'];
const remove = () => { IDS.forEach((id) => document.getElementById(id)?.remove()); window.__mvelaWidget = false; };

/** Shows this website's own chat widget on every page as soon as it is published. */
export default function WidgetLoader() {
  const hide = useLocation().pathname.startsWith('/embed'); // never inside the chat window itself
  useEffect(() => {
    if (hide) return undefined;
    let alive = true;
    const load = async () => {
      remove();
      try {
        const d = await api('/api/widget/default');
        if (!alive) return;
        const s = document.createElement('script');
        s.id = 'mvela-widget-script'; s.src = d.scriptUrl; s.async = true; s.setAttribute('data-key', d.key);
        document.body.appendChild(s);
      } catch { /* not published: show nothing */ }
    };
    load();
    window.addEventListener('mvela-widget-changed', load);
    return () => { alive = false; window.removeEventListener('mvela-widget-changed', load); remove(); };
  }, [hide]);
  return null;
}
