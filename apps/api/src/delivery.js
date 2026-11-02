// Sends the one-time code. OTP_CHANNEL is a comma list of: demo | email | sms
//   demo   shows the code in the chat (development only; never in production)
//   email  via Resend (https://resend.com), needs RESEND_API_KEY
//   sms    via Africa's Talking (https://africastalking.com), needs AT_API_KEY and AT_USERNAME
// If OTP_CHANNEL is not set, it falls back to the old behaviour: OTP_DEMO=false means nothing is shown.
import { submit } from './queue.js';

export const otpChannels = () => {
  const raw = (process.env.OTP_CHANNEL || (process.env.OTP_DEMO === 'false' ? '' : 'demo')).toLowerCase();
  return raw.split(',').map((s) => s.trim()).filter((s) => ['demo', 'email', 'sms'].includes(s));
};
export const channelWords = () => {
  const c = otpChannels().filter((x) => x !== 'demo');
  return c.length ? ' by ' + c.map((x) => (x === 'sms' ? 'SMS' : 'email')).join(' and ') : '';
};
export const maskEmail = (e) => (e && e.includes('@') ? `${e[0]}***@${e.split('@')[1]}` : '');

class DeliveryError extends Error { constructor(m, transient) { super(m); this.transient = transient; } }
const form = (o) => new URLSearchParams(o).toString();

async function sendEmail({ to, code, business }) {
  if (!process.env.RESEND_API_KEY) throw new DeliveryError('RESEND_API_KEY is not set', false);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: process.env.OTP_EMAIL_FROM || 'Mvela AI <onboarding@resend.dev>', to: [to], subject: `Your ${business} verification code`,
      html: `<p>Your verification code is <strong style="font-size:20px;letter-spacing:3px">${code}</strong>.</p><p>It expires in 5 minutes. Never share it with anyone, including ${business} staff.</p>`,
    }),
  });
  if (!res.ok) throw new DeliveryError(`Email provider HTTP ${res.status}`, res.status >= 500 || res.status === 429);
}

async function sendSms({ to, code, business }) {
  if (!process.env.AT_API_KEY || !process.env.AT_USERNAME) throw new DeliveryError('AT_API_KEY / AT_USERNAME are not set', false);
  const base = (process.env.AT_BASE || 'https://api.africastalking.com').replace(/\/$/, '');
  const res = await fetch(`${base}/version1/messaging`, {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { apiKey: process.env.AT_API_KEY, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ username: process.env.AT_USERNAME, to, message: `${business}: your verification code is ${code}. It expires in 5 minutes. Never share it.`, ...(process.env.AT_SENDER_ID ? { from: process.env.AT_SENDER_ID } : {}) }),
  });
  if (!res.ok) throw new DeliveryError(`SMS provider HTTP ${res.status}`, res.status >= 500 || res.status === 429);
  const r = (await res.json().catch(() => ({})))?.SMSMessageData?.Recipients?.[0];
  if (r && ![100, 101, 102].includes(Number(r.statusCode)) && r.status !== 'Success') throw new DeliveryError(`SMS not accepted: ${r.status || r.statusCode}`, false);
}

/** Never throws. Returns { demoOtp?, sent: [...channels that worked], failed: [{channel, error}] }. */
export async function deliverOtp({ customer, code, conversationId, business = 'Mvela AI' }) {
  const out = { sent: [], failed: [] };
  for (const ch of otpChannels()) {
    if (ch === 'demo') { out.demoOtp = code; out.sent.push('demo'); continue; }
    const to = ch === 'email'
      ? (process.env.DEMO_EMAIL_TO && /@example\.com$/i.test(customer.email || '') ? process.env.DEMO_EMAIL_TO : customer.email)
      : customer.phone;
    if (!to) { out.failed.push({ channel: ch, error: 'no contact on file' }); continue; }
    try {
      await submit(`otp.${ch}`, () => (ch === 'email' ? sendEmail : sendSms)({ to, code, business }), { conversationId, priority: 2 });
      out.sent.push(ch);
    } catch (e) { out.failed.push({ channel: ch, error: String(e.message).slice(0, 160) }); }
  }
  return out;
}
