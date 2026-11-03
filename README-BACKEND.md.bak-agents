# Mvela AI: backend

`apps/api` is now a working service. The dashboard reads real numbers from a database, and the chat agent verifies customers, calls tools against that database, logs an audit trail and escalates risky requests.

## Run it

```bash
npm install
cp apps/api/.env.example apps/api/.env   # only if you don't have one yet
npm run dev                               # API :4000 + web :5173
```

Open http://localhost:5173/app/demo. The first start creates `apps/api/data/mvela.db` and seeds synthetic customers, transactions, a knowledge base and sample conversation history.

Try this: type "my mobile money transfer failed", then `0976 000 001`, then the 6-digit code shown in the chat.

```bash
npm test          # 17 end-to-end API tests (verification, isolation, redaction, escalation, Gemini loop)
npm run seed      # wipe and re-seed the demo data
```

## Turn on the LLM

The agent runs on a built-in rules engine with no key. For natural language in English, Bemba and Nyanja:

1. Get a free key at https://aistudio.google.com/apikey
2. Put it in `apps/api/.env` as `GEMINI_API_KEY=...`
3. Restart. The API log says `agent: Gemini (...)`.

If Gemini is down or rate-limited, the customer still gets an answer from the rules engine and the failure is written to the audit log.

## How the agent is built

```
customer message
  -> redact PINs / card numbers
  -> risk check (fraud, complaint, card block, "send money", wants a human)  -> escalate immediately
  -> not verified?  phone number -> OTP -> verified   (server state machine, the LLM is not involved)
  -> verified: Gemini (or rules) answers using TOOLS
        get_account_summary / get_recent_transactions / get_transaction_status / get_card_status   (read-only)
        search_knowledge
        escalate_to_human  (the only write: it opens a ticket)
  -> scrub output, store, audit
```

Why this is safe to show a bank:
- Identity checks are code, not a prompt. The model can't be talked out of them.
- Tools take the customer from the verified session, never from model arguments, so a customer can't read another customer's data (there's a test for it).
- There is no tool that moves money or edits records. Card blocking goes to a human.
- Unknown phone numbers get the same reply as known ones (no customer enumeration). OTPs are hashed, expire in 5 minutes, lock after 3 tries.
- Every tool call, verification, failure and escalation is in `audit_logs`, visible per conversation in the dashboard.

## API

| Route | Purpose |
|---|---|
| `POST /api/chat/start`, `POST /api/chat`, `GET /api/chat/:id` | Customer chat |
| `POST /api/contact` | Demo requests from the marketing site, stored in `leads` |
| `GET /api/admin/overview?days=7` | Dashboard metrics, computed from the DB |
| `GET /api/admin/conversations`, `/:id` | List and detail with transcript + audit |
| `GET/PATCH /api/admin/escalations` | Queue, mark resolved |
| `GET/POST/PUT/DELETE /api/admin/knowledge` | Knowledge base CRUD |
| `GET /api/admin/leads` | Demo requests |
| `POST /api/auth/login`, `GET /api/auth/me` | Dashboard sign-in. All `/api/admin/*` routes now require the token |
| `GET/PUT /api/admin/widget` | View, edit and publish the website chat widget |
| `GET /api/widget/config?key=&parent=` | Public: used by `/widget.js` to decide whether to show the widget |
| `GET /widget.js` | The embed script customers paste on their site |

## Honest limitations (read before a pitch)

- **Synthetic data only.** All customers, balances and transactions are made up. "Connecting to the bank's system" means replacing the functions in `apps/api/src/tools.js` with calls to the bank's real API. The tool boundary is the only thing that changes.
- **OTP is demo-mode.** There is no SMS provider, so the code is shown in the chat (`OTP_DEMO=true`). For real use, send it from `deliverOtp()` in `agent.js` (Africa's Talking is a common choice in Zambia) and set `OTP_DEMO=false`.
- **Sign-in is basic.** One owner account (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`), password login, 12-hour sessions, login rate limit. There is no password reset, no invites and no roles yet, and it is still one business (no multi-tenancy).
- **"Hours saved" is an estimate** (AI-resolved conversations x `HANDLE_MINUTES`). The UI labels it as such. "AI resolved" means the AI answered and nothing was escalated; it is not customer-confirmed.
- **Voice calls, WhatsApp, SMS are not built.** Chat only. The agent core (`handleMessage`) is channel-independent, so those are adapters on top.
- **Bemba/Nyanja:** language detection is a small keyword heuristic, and replies in those languages come from Gemini only (the rules fallback answers in English). The sample Bemba/Nyanja lines in seeded history are placeholders and need a native speaker's review.
- **SQLite** is right for a prototype or pilot. Move to Postgres before real volume.


## Publishing the widget

1. Sign in at `/login`, open **Publish widget**, switch it on, save.
2. Copy the one-line snippet onto any website, or try `/widget-test.html?key=YOUR_KEY`.
3. In production set `PUBLIC_API_URL` (API address) and `CLIENT_ORIGIN` (web app address) so the snippet and the chat window point to the right places, and make sure the web host allows the `/embed` page to be framed (no `X-Frame-Options: DENY`).

"Allowed websites" only checks the origin the script reports, so it deters casual copying but is not a security control. Real protection is the rate limit, OTP verification and read-only tools.
