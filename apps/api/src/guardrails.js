// Pre/post-processing that does not depend on any LLM.

/** Normalise a Zambian phone number to +260XXXXXXXXX, or null. */
export function normalizePhone(input) {
  const d = String(input || '').replace(/[^\d]/g, '');
  if (d.length === 12 && d.startsWith('260')) return '+' + d;
  if (d.length === 10 && d.startsWith('0')) return '+260' + d.slice(1);
  if (d.length === 9) return '+260' + d;
  return null;
}

/** Find a phone-number-looking token inside free text, whatever the spacing (0976 000 001, 097 600 0001, +260 976...). */
export function extractPhone(text) {
  for (const m of String(text || '').matchAll(/\+?\d[\d\s-]{7,16}\d/g)) {
    const p = normalizePhone(m[0]);
    if (p) return p;
  }
  return null;
}

export function extractOtp(text) {
  const t = String(text || '');
  const m = t.match(/\b\d{6}\b/);
  if (m) return m[0];
  // Speech-to-text often returns digits spaced out ("3 5 3 0 1 2" or "353 012"). Only accept
  // this when the whole message is just digits, so ordinary sentences are never misread.
  if (/^[\d\s-]+$/.test(t.trim())) { const d = t.replace(/\D/g, ''); if (d.length === 6) return d; }
  return null;
}

/** Remove card numbers, PINs and passwords before anything is stored or sent to an LLM. */
export function redact(text) {
  let out = String(text || '');
  let hit = false;
  out = out.replace(/\b(?:\d[ -]?){13,19}\b/g, () => ((hit = true), '[card number removed]'));
  out = out.replace(/\b(pin|password|passcode|secret)\b([^\n]{0,25}?)\b\d{4,8}\b/gi, (_m, k) => ((hit = true), `${k} [removed]`));
  return { text: out, sensitive: hit };
}

const RULES = [
  { type: 'fraud', priority: 'high', re: /(fraud|scam|stolen|hack|unauthori[sz]ed|did ?n[o']?t (make|do|authori[sz]e)|not me|someone (else )?(took|used|withdrew)|phish|lost (my )?(phone|card|sim)|sim swap)/i },
  { type: 'complaint', priority: 'normal', re: /(complain|complaint|unhappy|angry|furious|ombudsman|lawyer|sue |terrible service|useless)/i },
  { type: 'human', priority: 'normal', re: /(speak (to|with) (a |an )?(human|person|agent|someone|staff)|talk to (a |an )?(human|person|agent)|real person|human agent|call me back)/i },
  { type: 'card_action', priority: 'high', re: /((block|freeze|cancel|unblock|deactivate|replace|reset).{0,20}(card|atm)|(card|atm).{0,20}(block|freeze|cancel|unblock|replace))/i },
  { type: 'out_of_scope', priority: 'normal', re: /(send (some )?money|transfer (money )?to|make a (payment|transfer)|pay (for|my|him|her)|withdraw|change (my )?(pin|password|phone|address)|reset (my )?(pin|password)|close (my )?account|update my (details|info))/i },
];

/** Returns the first matching high-risk rule or null. */
export function riskCheck(text) {
  for (const r of RULES) if (r.re.test(text)) return { type: r.type, priority: r.priority };
  return null;
}

// Small keyword heuristic for analytics. Replace with a proper classifier later.
const BEMBA = /\b(mwapoleni|muli shani|shani|bwino|ndefwaya|ukwishiba|ifyo|natotela|mukwai|ishiwe|nshi|ndalama shandi|mali yandi|pamo|cinshi|bushe|ala|nalimona|naposha|tapali)\b/i;
const NYANJA = /\b(muli bwanji|bwanji|zikomo|ndikufuna|ndalama zanga|chonde|sindinalandire|ndalama|kulipira|ndili|ndikuthokoza|ine|kodi|inde|ayi|mwandi)\b/i;
export function detectLanguage(text) {
  const b = BEMBA.test(text), n = NYANJA.test(text);
  if (b && !n) return 'Bemba';
  if (n && !b) return 'Nyanja';
  if (b && n) return /\b(ndefwaya|ukwishiba|mwapoleni|ifyo)\b/i.test(text) ? 'Bemba' : 'Nyanja';
  return 'English';
}

export function detectIntent(text) {
  const t = text.toLowerCase();
  if (/(thank|thanks|zikomo|natotela|that'?s all|bye|goodbye|cheers)/.test(t) && t.length < 60) return 'thanks';
  if (/(txn-\d+|\bfail|didn'?t (go|arrive|receive|reach)|not (received|delivered|arrive|reach)|pending|stuck|revers|refund|deducted|where is my|status of)/.test(t)) return 'transaction_status';
  if (/(balance|how much (money )?do i have|how much is (in|left)|ndalama zanga|ndalama shandi)/.test(t)) return 'balance';
  if (/(transaction|statement|history|recent|last (few|\d+)|mini.?statement|spent|payments? i made)/.test(t)) return 'transactions';
  if (/\b(card|atm|visa|mastercard)\b/.test(t)) return 'card_status';
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|muli bwanji|mwapoleni|muli shani)\b/.test(t) && t.length < 40) return 'greeting';
  return 'general';
}

export const TOPIC_BY_INTENT = {
  balance: 'Balance enquiry', transactions: 'Recent transactions', transaction_status: 'Transaction status',
  card_status: 'Card enquiry', general: 'General enquiry', greeting: 'General enquiry', thanks: 'General enquiry',
  fraud: 'Fraud report', complaint: 'Complaint', human: 'Human request', card_action: 'Card block request', out_of_scope: 'Out-of-scope request',
};

/** Last line of defence on model output. */
export function scrubOutput(text) {
  return String(text || '').replace(/\b(?:\d[ -]?){13,19}\b/g, '[number removed]').trim();
}
