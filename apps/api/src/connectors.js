// Registry of outside services the server may call. URLs and credentials come ONLY from here and from
// environment variables, never from the customer or the model, so the agent cannot be steered to an arbitrary address.
// To add a service: add an entry below, then wrap it in an adapter (see bank.js) so the agent only sees clean data.
const REGISTRY = {
  bank: {
    baseUrl: () => process.env.BANK_API_URL,
    headers: () => ({ 'x-api-key': process.env.BANK_API_KEY || '', accept: 'application/json' }),
    timeoutMs: () => Number(process.env.BANK_TIMEOUT_MS) || 5000,
    operations: {
      lookupCustomer: { method: 'GET', path: '/v1/customers/lookup' },
      getAccounts: { method: 'GET', path: '/v1/customers/{customerId}/accounts' },
      getTransactions: { method: 'GET', path: '/v1/customers/{customerId}/transactions' },
      getTransaction: { method: 'GET', path: '/v1/customers/{customerId}/transactions/{reference}' },
      getCards: { method: 'GET', path: '/v1/customers/{customerId}/cards' },
    },
  },
};

export class ConnectorError extends Error {
  constructor(message, { status, transient }) { super(message); this.name = 'ConnectorError'; this.status = status; this.transient = transient; }
}

/** Returns parsed JSON, or null on HTTP 404. Throws ConnectorError (transient or not) otherwise. */
export async function callConnector(name, op, { params = {}, query = {} } = {}) {
  const c = REGISTRY[name];
  const o = c?.operations[op];
  if (!c || !o) throw new ConnectorError(`Unknown connector operation ${name}.${op}`, { transient: false });
  const base = c.baseUrl();
  if (!base) throw new ConnectorError(`The ${name} connector is not configured (set BANK_API_URL)`, { transient: false });
  const path = o.path.replace(/\{(\w+)\}/g, (_m, k) => {
    if (params[k] == null || params[k] === '') throw new ConnectorError(`Missing ${k}`, { transient: false });
    return encodeURIComponent(String(params[k]));
  });
  const url = new URL(base.replace(/\/$/, '') + path);
  for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, String(v));
  let res;
  try { res = await fetch(url, { method: o.method, headers: c.headers(), signal: AbortSignal.timeout(c.timeoutMs()) }); }
  catch (e) { throw new ConnectorError(`${name}.${op} unreachable: ${e.cause?.code || e.message}`, { transient: true }); }
  if (res.status === 404) return null;
  if (!res.ok) throw new ConnectorError(`${name}.${op} returned HTTP ${res.status}`, { status: res.status, transient: res.status >= 500 || res.status === 429 });
  return res.json();
}
