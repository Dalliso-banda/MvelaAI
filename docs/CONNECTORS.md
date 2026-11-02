# Connectors, the job queue and OTP delivery

Mvela's agent never reaches the outside world directly. Everything goes through code the server controls.

```
customer ─> chat ─> agent (talks) ─> tools ─> bank adapter ─> job queue ("manager") ─> demo data  OR  bank REST API
                                          └─> deliverOtp ───> job queue ─> Resend (email) / Africa's Talking (SMS)
```

- **The agent only talks.** Verification is decided by code (phone lookup, OTP hash match), never by a model.
- **The queue is the manager.** Every outside call is a job: limited concurrency (`QUEUE_CONCURRENCY`, default 4),
  priority (OTP sends jump the line), timeout (`JOB_TIMEOUT_MS`, default 8000), up to 3 attempts on transient errors,
  and an audit row `job:<type>` per job.
- **Connector registry** (`apps/api/src/connectors.js`): URLs and keys come only from env vars. The customer and
  the model can never choose an address.
- **Adapter** (`apps/api/src/bank.js`): turns the bank's field names and units into Mvela's. `BANK_MODE=demo` (default) uses local data.

## Try it against the mock bank
```
npm run dev:bank            # terminal 2: fake bank on :4100
```
In `apps/api/.env`:
```
BANK_MODE=http
BANK_API_URL=http://localhost:4100
BANK_API_KEY=dev-bank-key
```
Restart `npm run dev`. Mock customers: +260976000001, +260976000002 (active), +260976000003 (closed, gets no code).

## Connect a real bank
Match the endpoints in `connectors.js` (or edit them) and the field mapping in `bank.js` (`toTx` and friends).

## Real OTP delivery
```
OTP_CHANNEL=sms            # or email, or email,sms. demo shows the code in chat (development only)
AT_API_KEY=...  AT_USERNAME=...  AT_SENDER_ID=Mvela     # Africa's Talking
RESEND_API_KEY=...  OTP_EMAIL_FROM="Mvela AI <you@yourdomain>"   # Resend
DEMO_EMAIL_TO=you@gmail.com   # test only: sends mock @example.com customers' emails to you
```
The chat says "sent by SMS" only; it never reveals whether a number is registered.
Use `OTP_CHANNEL=demo` for the hackathon demo video, a real channel in production.
