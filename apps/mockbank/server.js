// A stand-in for a real bank's REST API, so Mvela can be tested against an outside service.
// Different field names and units from Mvela on purpose (balance is a decimal, reference not id),
// so the adapter in apps/api/src/bank.js has real translating to do. Replace with the real bank later.
import express from 'express';

const KEY = () => process.env.MOCKBANK_API_KEY || 'dev-bank-key';
const PORT = Number(process.env.MOCKBANK_PORT) || 4100;

const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const DATA = {
  C001: { name: 'Chanda Mulenga', phone: '+260976000001', email: 'chanda@example.com', status: 'active' },
  C002: { name: 'Mwila Bwalya', phone: '+260976000002', email: 'mwila@example.com', status: 'active' },
  C003: { name: 'Natasha Phiri', phone: '+260976000003', email: 'natasha@example.com', status: 'closed' },
};
const ACCOUNTS = {
  C001: [{ type: 'savings', number_masked: '****4001', currency: 'ZMW', balance: 4210.5, status: 'active' }, { type: 'current', number_masked: '****7002', currency: 'ZMW', balance: 610, status: 'active' }],
  C002: [{ type: 'savings', number_masked: '****4138', currency: 'ZMW', balance: 9120.25, status: 'active' }],
  C003: [],
};
const TX = {
  C001: [
    { reference: 'TXN-B00001', type: 'mobile_money', direction: 'debit', amount: 500, counterparty: '0966 112 233', channel: 'MTN MoMo', status: 'failed', failure_code: 'INSUFFICIENT_FUNDS', created_at: ago(0.2), account_type: 'current', account_masked: '****7002' },
    { reference: 'TXN-B00002', type: 'mobile_money', direction: 'debit', amount: 1200, counterparty: '0977 445 566', channel: 'Airtel Money', status: 'pending', created_at: ago(0.05), account_type: 'savings', account_masked: '****4001' },
    { reference: 'TXN-B00003', type: 'card_purchase', direction: 'debit', amount: 86.4, counterparty: 'Shoprite Manda Hill', channel: 'Card', status: 'completed', created_at: ago(2), account_type: 'current', account_masked: '****7002' },
  ],
  C002: [{ reference: 'TXN-B00010', type: 'transfer_out', direction: 'debit', amount: 300, counterparty: 'Kabwe Traders', channel: 'Bank transfer', status: 'completed', created_at: ago(1), account_type: 'savings', account_masked: '****4138' }],
  C003: [],
};
const CARDS = { C001: [{ last4: '4821', status: 'active', expiry: '2028-05' }], C002: [{ last4: '1913', status: 'active', expiry: '2029-01' }], C003: [] };

export function createBank() {
  const app = express();
  app.use((req, res, next) => (req.get('x-api-key') === KEY() ? next() : res.status(401).json({ error: 'invalid api key' })));
  const known = (req, res) => (DATA[req.params.id] ? true : (res.status(404).json({ error: 'no such customer' }), false));

  app.get('/v1/customers/lookup', (req, res) => {
    const phone = String(req.query.phone || '');
    const id = Object.keys(DATA).find((k) => DATA[k].phone === phone);
    if (!id) return res.status(404).json({ error: 'not found' });
    res.json({ customer: { id, ...DATA[id] } });
  });
  app.get('/v1/customers/:id/accounts', (req, res) => known(req, res) && res.json({ accounts: ACCOUNTS[req.params.id] }));
  app.get('/v1/customers/:id/transactions', (req, res) => {
    if (!known(req, res)) return;
    const want = req.query.status ? String(req.query.status).split(',') : null;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const rows = TX[req.params.id].filter((t) => !want || want.includes(t.status)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    res.json({ transactions: rows });
  });
  app.get('/v1/customers/:id/transactions/:ref', (req, res) => {
    if (!known(req, res)) return;
    const t = TX[req.params.id].find((x) => x.reference.toUpperCase() === req.params.ref.toUpperCase());
    t ? res.json({ transaction: t }) : res.status(404).json({ error: 'not found' });
  });
  app.get('/v1/customers/:id/cards', (req, res) => known(req, res) && res.json({ cards: CARDS[req.params.id] }));
  return app;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createBank().listen(PORT, () => console.log(`[mockbank] listening on http://localhost:${PORT} (x-api-key: ${KEY()})`));
}
