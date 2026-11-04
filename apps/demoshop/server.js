// Chalo Threads: a fake online shop with synthetic data. It exists to show a company connecting its own system to Mvela.
//   GET /                      the shop page, with the Mvela chat widget on it
//   GET /api/orders/:id        order status   (needs the x-shop-key header)
//   GET /api/stock/:item       stock check    (needs the x-shop-key header)
// The order endpoint returns more than the AI should share (customer email, internal notes) on purpose,
// so you can see Mvela's "fields the AI may share" list hide them.
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const day = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const orders = () => ({
  'TZ-1001': { order_id: 'TZ-1001', status: 'shipped', estimated_delivery: iso(2), carrier: 'Post Courier', tracking_number: 'PC-48213', items: ['Denim jacket (M)', 'Wool scarf'], total_zmw: 420, customer_email: 'mutale@example.com', internal_note: 'Repeat customer, offered 10% next time' },
  'TZ-1002': { order_id: 'TZ-1002', status: 'processing', estimated_delivery: iso(4), carrier: null, tracking_number: null, items: ['Linen shirt (L)'], total_zmw: 180, customer_email: 'chanda@example.com', internal_note: 'Payment confirmed by mobile money' },
  'TZ-1003': { order_id: 'TZ-1003', status: 'delivered', estimated_delivery: iso(-3), carrier: 'Post Courier', tracking_number: 'PC-47002', items: ['Leather belt'], total_zmw: 95, customer_email: 'bwalya@example.com', internal_note: 'Signed for by neighbour' },
  'TZ-1004': { order_id: 'TZ-1004', status: 'delayed', estimated_delivery: iso(5), carrier: 'Post Courier', tracking_number: 'PC-48390', items: ['Winter coat (XL)', 'Gloves'], total_zmw: 560, delay_reason: 'The courier is short of vehicles between Kitwe and Lusaka this week.', customer_email: 'natasha@example.com', internal_note: 'Customer already chased twice, escalate if asked again' },
  'TZ-1005': { order_id: 'TZ-1005', status: 'cancelled', estimated_delivery: null, carrier: null, tracking_number: null, items: ['Sneakers (42)'], total_zmw: 300, refund_status: 'Refund of K300 sent to mobile money, usually within 3 working days.', customer_email: 'kelvin@example.com', internal_note: 'Out of stock after payment' },
  'TZ-1006': { order_id: 'TZ-1006', status: 'ready_for_pickup', estimated_delivery: iso(0), carrier: 'Store pickup', tracking_number: null, items: ['Handbag'], total_zmw: 210, pickup_location: 'Chalo Threads, Cairo Road, Lusaka (Mon-Sat 8am-5pm)', customer_email: 'mwila@example.com', internal_note: 'Hold for 7 days' },
});
const stock = {
  jacket: { item: 'Denim jacket', in_stock: true, sizes: ['S', 'M', 'L'], price_zmw: 250 },
  coat: { item: 'Winter coat', in_stock: true, sizes: ['L', 'XL'], price_zmw: 480 },
  sneakers: { item: 'Sneakers', in_stock: false, sizes: [], price_zmw: 300, restock: 'Expected in about two weeks' },
  shirt: { item: 'Linen shirt', in_stock: true, sizes: ['M', 'L', 'XL'], price_zmw: 180 },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page({ mvelaUrl, widgetKey }) {
  const widget = widgetKey
    ? `<script src="${esc(mvelaUrl)}/widget.js" data-key="${esc(widgetKey)}" async></script>`
    : '<!-- Set WIDGET_KEY (from Mvela: Publish widget) to show the chat bubble -->';
  const hint = widgetKey ? '' : '<p class="warn">The chat bubble is off: set <code>WIDGET_KEY</code> and <code>MVELA_URL</code> in <code>apps/demoshop/.env</code> and restart.</p>';
  const items = [['Denim jacket', 'K250', '#5b7ba6'], ['Winter coat', 'K480', '#7a5a4a'], ['Linen shirt', 'K180', '#c9b79c'], ['Wool scarf', 'K70', '#a64b4b'], ['Leather belt', 'K95', '#3b3b3b'], ['Handbag', 'K210', '#6b8f71']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chalo Threads</title>
<style>:root{--ink:#1d2433;--mute:#5b6577;--bg:#faf8f4;--accent:#c2410c}*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,sans-serif;color:var(--ink);background:var(--bg)}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;max-width:1000px;margin:auto}header b{font-size:20px;letter-spacing:.3px}header span{color:var(--mute);font-size:14px}
main{max-width:1000px;margin:auto;padding:0 24px 60px}.hero{padding:40px 0 24px}.hero h1{font-size:clamp(28px,5vw,44px);line-height:1.1;margin:0 0 12px}.hero p{color:var(--mute);max-width:560px;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;margin:28px 0}.card{border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}.card i{display:block;height:110px}.card div{padding:10px 12px}.card small{color:var(--mute)}
.box{background:#fff;border-radius:12px;padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-top:20px}.box h2{margin:0 0 6px;font-size:18px}code{background:#efe9df;padding:1px 6px;border-radius:5px}.warn{background:#fff3cd;padding:10px 14px;border-radius:8px}
footer{max-width:1000px;margin:auto;padding:0 24px 40px;color:var(--mute);font-size:13px}</style></head><body>
<header><b>Chalo Threads</b><span>Second-hand style, Lusaka</span></header>
<main><section class="hero"><h1>Good clothes, second time around.</h1><p>Hand-picked second-hand fashion, delivered across Zambia. Questions about an order or an item? Ask the assistant in the corner.</p></section>
${hint}<div class="grid">${items.map(([n, p, c]) => `<div class="card"><i style="background:${c}"></i><div><b>${n}</b><br><small>${p}</small></div></div>`).join('')}</div>
<div class="box"><h2>Things to ask the assistant</h2><p>“Where is my order TZ-1001?” &nbsp;·&nbsp; “Why is TZ-1004 late?” &nbsp;·&nbsp; “Is the winter coat in stock?” &nbsp;·&nbsp; “What happened to TZ-1005?”</p><p style="margin-bottom:0;color:var(--mute);font-size:14px">Demo orders: <code>TZ-1001</code> to <code>TZ-1006</code>. All data on this page is made up.</p></div></main>
<footer>Chalo Threads is a fictional shop built to demonstrate Mvela AI lookups. No real orders or customers.</footer>${widget}</body></html>`;
}

export function createShop({ apiKey = process.env.SHOP_API_KEY || 'demo-shop-key', mvelaUrl = process.env.MVELA_URL || 'http://localhost:4000', widgetKey = process.env.WIDGET_KEY || '' } = {}) {
  const data = orders();
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
    if (req.method !== 'GET') return send(405, { error: 'GET only' });
    if (url.pathname === '/' || url.pathname === '/index.html') return send(200, page({ mvelaUrl, widgetKey }), 'text/html');
    if (url.pathname === '/health') return send(200, { ok: true });
    const m = url.pathname.match(/^\/api\/(orders|stock)\/([^/]+)$/);
    if (!m) return send(404, { error: 'Not found' });
    if (req.headers['x-shop-key'] !== apiKey) return send(401, { error: 'Missing or wrong x-shop-key' });
    let id; try { id = decodeURIComponent(m[2]).trim(); } catch { return send(400, { error: 'Bad request' }); }
    if (m[1] === 'orders') { const o = data[id.toUpperCase()]; return o ? send(200, o) : send(404, { error: 'No such order' }); }
    const s = stock[id.toLowerCase().replace(/s$/, '')] || stock[id.toLowerCase()];
    return s ? send(200, s) : send(404, { error: 'No such item' });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 4200;
  createShop().listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Chalo Threads demo shop on http://localhost:${port}`));
}
