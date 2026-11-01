// Synthetic data only. No real customer information.
import { pathToFileURL } from 'node:url';
import { db, now } from './db.js';

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const daysAgo = (d, rand = 0) => new Date(Date.now() - d * 864e5 - rand * 864e5 * 0.9).toISOString();

export const DEMO_CUSTOMERS = [
  ['C001', 'Chanda Mulenga', '+260976000001', 'Bemba'], ['C002', 'Mwila Bwalya', '+260976000002', 'Bemba'],
  ['C003', 'Natasha Phiri', '+260976000003', 'Nyanja'], ['C004', 'Mutale Chola', '+260976000004', 'English'],
  ['C005', 'Thandiwe Banda', '+260976000005', 'Nyanja'], ['C006', 'Joseph Zulu', '+260976000006', 'English'],
  ['C007', 'Bupe Kasonde', '+260976000007', 'Bemba'], ['C008', 'Memory Tembo', '+260976000008', 'Nyanja'],
];

const KNOWLEDGE = [
  ['Branch and call-centre hours', 'Branches are open Monday to Friday 08:00 to 16:00 and Saturday 08:00 to 12:00. Mvela AI is available 24/7. Human agents are available 07:00 to 19:00 daily.', 'hours opening branch open close time'],
  ['Mobile money transfer limits', 'Transfers to mobile wallets are limited to K5,000 per transaction and K15,000 per day. Higher limits can be requested through a human agent.', 'limit limits daily mobile money momo airtel transfer maximum'],
  ['Transfer fees', 'Bank-to-bank transfers cost K5 within the bank and K12 to other banks. Transfers to mobile wallets cost 1% of the amount, capped at K30.', 'fee fees charges cost price transfer'],
  ['Failed or pending transfers', 'If a transfer fails, no money should leave your account. If you were debited, the amount is normally reversed automatically within 24 hours. If it is not, a human agent can trace the transaction.', 'failed fail pending reversal reverse refund stuck deducted'],
  ['Card replacement and blocking', 'To block or replace a card, a human agent must verify you first. Replacement cards are ready in 3 to 5 working days at your chosen branch.', 'card lost stolen replace replacement block'],
  ['Forgotten PIN or password', 'For your safety Mvela AI cannot reset or see your PIN or password. A human agent or a branch visit with your ID is required to reset them.', 'pin password forgot reset locked'],
  ['Opening an account', 'You need your NRC and proof of address. Mobile wallets can be opened with your NRC and a registered SIM.', 'open account new register nrc documents'],
  ['Security tips', 'We will never ask for your PIN, password, or a one-time code. If someone does, hang up and report it.', 'security scam fraud safe phishing otp'],
];

export function seedAll({ reset = false } = {}) {
  if (reset) {
    db.exec('DELETE FROM audit_logs; DELETE FROM escalations; DELETE FROM otps; DELETE FROM messages; DELETE FROM conversations; DELETE FROM transactions; DELETE FROM cards; DELETE FROM accounts; DELETE FROM customers; DELETE FROM knowledge; DELETE FROM leads;');
  }
  if (db.prepare('SELECT COUNT(*) c FROM customers').get().c === 0) seedBank();
  if (db.prepare('SELECT COUNT(*) c FROM knowledge').get().c === 0) {
    const ins = db.prepare('INSERT INTO knowledge (title, body, tags, updated_at) VALUES (?,?,?,?)');
    for (const [t, b, g] of KNOWLEDGE) ins.run(t, b, g, now());
  }
  if (process.env.SEED_HISTORY !== 'false' && db.prepare("SELECT COUNT(*) c FROM conversations WHERE source='seed'").get().c === 0) seedHistory();
}

function seedBank() {
  const r = rng(42);
  const insC = db.prepare('INSERT INTO customers (id, name, phone, language, created_at) VALUES (?,?,?,?,?)');
  const insA = db.prepare('INSERT INTO accounts (id, customer_id, type, number_masked, balance_ngwee, status) VALUES (?,?,?,?,?,?)');
  const insK = db.prepare('INSERT INTO cards (id, customer_id, account_id, last4, status, expiry) VALUES (?,?,?,?,?,?)');
  const insT = db.prepare('INSERT INTO transactions (id, account_id, type, direction, amount_ngwee, counterparty, channel, status, failure_code, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const peers = ['Mercy Lungu', 'Kabwe Traders', 'ZESCO Prepaid', 'Shoprite Manda Hill', 'Airtel Airtime', 'DStv Zambia', 'Peter Mwansa', 'Lusaka Water', 'Pick n Pay Kitwe', 'Grace Daka'];
  const channels = ['MTN MoMo', 'Airtel Money', 'Zamtel Kwacha', 'Bank transfer', 'Card'];
  let n = 1;

  DEMO_CUSTOMERS.forEach(([id, name, phone, lang], i) => {
    insC.run(id, name, phone, lang, daysAgo(200 + i * 20));
    const sav = `A${id}S`, cur = `A${id}C`;
    insA.run(sav, id, 'savings', `****${4000 + i * 137}`, Math.round((800 + r() * 14000) * 100), 'active');
    insA.run(cur, id, 'current', `****${7000 + i * 211}`, Math.round((150 + r() * 4000) * 100), i === 7 ? 'frozen' : 'active');
    insK.run(`K${id}`, id, cur, String(1000 + i * 913).slice(-4), 'active', '2028-' + String(1 + (i % 12)).padStart(2, '0'));
    for (let k = 0; k < 14; k++) {
      const debit = r() < 0.72, ch = channels[Math.floor(r() * channels.length)];
      insT.run(`TXN-${100000 + n++}`, r() < 0.5 ? sav : cur, ch === 'Card' ? 'card_purchase' : ch === 'Bank transfer' ? 'transfer_out' : 'mobile_money',
        debit ? 'debit' : 'credit', Math.round((20 + r() * 1500) * 100), peers[Math.floor(r() * peers.length)], ch, 'completed', null, daysAgo(0.3 + k * 1.8, r()));
    }
  });
  // Named scenarios so demo scripts are repeatable.
  const S = [
    ['TXN-900001', 'AC001C', 'mobile_money', 'debit', 50000, '0966 112 233', 'MTN MoMo', 'failed', 'INSUFFICIENT_FUNDS', 0.2],
    ['TXN-900002', 'AC001S', 'mobile_money', 'debit', 120000, '0977 445 566', 'Airtel Money', 'pending', null, 0.05],
    ['TXN-900003', 'AC002C', 'mobile_money', 'debit', 75000, '0955 332 211', 'Zamtel Kwacha', 'failed', 'NETWORK_TIMEOUT', 0.4],
    ['TXN-900004', 'AC003S', 'transfer_out', 'debit', 300000, 'Kabwe Traders', 'Bank transfer', 'failed', 'INVALID_RECIPIENT', 0.6],
    ['TXN-900005', 'AC004C', 'mobile_money', 'debit', 650000, '0966 998 877', 'MTN MoMo', 'failed', 'DAILY_LIMIT_EXCEEDED', 0.3],
    ['TXN-900006', 'AC005S', 'mobile_money', 'debit', 90000, '0977 123 456', 'Airtel Money', 'reversed', null, 0.7],
    ['TXN-900007', 'AC006C', 'mobile_money', 'debit', 200000, '0966 000 555', 'MTN MoMo', 'failed', 'RECIPIENT_LIMIT_EXCEEDED', 0.5],
  ];
  for (const s of S) insT.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], daysAgo(s[9]));
}

// ---- sample history so the dashboard has something to show on a fresh install
const TOPICS = [['Balance enquiry', 30], ['Transaction status', 28], ['Recent transactions', 14], ['Card enquiry', 8], ['General enquiry', 12], ['Fraud report', 3], ['Card block request', 5]];
const OPEN = {
  English: { 'Balance enquiry': 'What is my balance?', 'Transaction status': 'My mobile money transfer failed, what happened?', 'Recent transactions': 'Can I see my last transactions?', 'Card enquiry': 'Is my card active?', 'General enquiry': 'What are your opening hours?', 'Fraud report': 'There is a payment I did not make.', 'Card block request': 'Please block my card, I lost it.' },
  Bemba: { _: 'Mwapoleni, ndefwaya ukwishiba pa ndalama shandi.' },
  Nyanja: { _: 'Muli bwanji, ndikufuna kudziwa za ndalama zanga.' },
};
const ANSWER = { 'Balance enquiry': 'Here are your balances: savings K4,210.50, current K610.00.', 'Transaction status': 'That transfer failed because the account did not have enough balance. No money left the account.', 'Recent transactions': 'Here are your latest 5 transactions.', 'Card enquiry': 'Your card ending 4821 is active.', 'General enquiry': 'Branches are open Monday to Friday, 08:00 to 16:00.', 'Fraud report': "I've marked this as urgent and passed it to a human agent.", 'Card block request': "I've sent this to a human agent as a priority." };

function pickWeighted(r, items) { const total = items.reduce((s, [, w]) => s + w, 0); let x = r() * total; for (const [v, w] of items) { if ((x -= w) <= 0) return v; } return items[0][0]; }

function seedHistory() {
  const r = rng(7);
  const insConv = db.prepare("INSERT INTO conversations (id, channel, language, customer_id, state, status, topic, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,'seed',?,?)");
  const insMsg = db.prepare('INSERT INTO messages (conversation_id, role, kind, content, latency_ms, created_at) VALUES (?,?,?,?,?,?)');
  const insEsc = db.prepare('INSERT INTO escalations (conversation_id, reason, priority, summary, status, note, created_at, resolved_at) VALUES (?,?,?,?,?,?,?,?)');
  db.transaction(() => {
    for (let i = 0; i < 48; i++) {
      const topic = pickWeighted(r, TOPICS);
      const lang = pickWeighted(r, [['English', 58], ['Bemba', 24], ['Nyanja', 18]]);
      const escalated = ['Fraud report', 'Card block request'].includes(topic) || r() < 0.14;
      const status = escalated ? (r() < 0.5 ? 'human_resolved' : 'escalated') : 'ai_resolved';
      const cust = DEMO_CUSTOMERS[Math.floor(r() * DEMO_CUSTOMERS.length)][0];
      const created = daysAgo(r() * 7);
      const id = `seed-${String(i + 1).padStart(3, '0')}`;
      insConv.run(id, 'web', lang, cust, 'verified', status, topic, created, created);
      insMsg.run(id, 'customer', 'chat', lang === 'English' ? OPEN.English[topic] : OPEN[lang]._, null, created);
      insMsg.run(id, 'assistant', 'chat', ANSWER[topic], 1200 + Math.round(r() * 5200), created);
      if (escalated) insEsc.run(id, `${topic} (auto-detected)`, topic === 'Fraud report' ? 'high' : 'normal', `Customer: ${lang === 'English' ? OPEN.English[topic] : OPEN[lang]._}\nAI: ${ANSWER[topic]}`,
        status === 'human_resolved' ? 'resolved' : 'open', status === 'human_resolved' ? 'Resolved by agent (sample).' : null, created, status === 'human_resolved' ? created : null);
    }
  })();
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  seedAll({ reset: process.argv.includes('--reset') });
  console.log('Seeded. Demo phone numbers: ' + DEMO_CUSTOMERS.map((c) => c[2]).join(', '));
}
