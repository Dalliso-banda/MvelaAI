# Mvela AI: backend, agent, widget, sign-in and voice (change log)

Branch scope: turns the front-end prototype into a working product. The dashboard now reads real data, the chat
agent verifies customers and calls tools against a database, companies can publish an embeddable chat widget behind
a sign-in, and customers can talk to the assistant by voice in the browser.

## 1. Backend (`apps/api`)
| File | What it does |
|---|---|
| `src/db.js` | SQLite (better-sqlite3) schema: customers, accounts, cards, transactions, conversations, messages, otps, audit_logs, escalations, knowledge, leads. |
| `src/seed.js` | **Synthetic data only**: 8 demo customers, named failure scenarios (TXN-900001...), 8 knowledge articles, 48 sample conversations. `npm run seed` resets. |
| `src/guardrails.js` | Phone normalisation (Zambian formats), OTP extraction (also spoken "3 5 3 0 1 2"), redaction of PINs/card numbers, risk rules (fraud, complaint, human request, card block, money movement), language and intent detection. |
| `src/tools.js` | The agent's only abilities. Read-only: account summary, recent transactions, transaction status (with failure reason and next step), card status, knowledge search. One write: `escalate_to_human`. The customer comes from the verified session, never from model arguments. |
| `src/agent.js` | The conversation engine (see section 2). |
| `src/llm.js` | LLM providers: **Meta Muse Spark** (OpenAI-compatible `https://api.meta.ai/v1`), Gemini, or none (rules engine). Tool-calling loop for both; a restricted "public mode" for unverified visitors. |
| `src/routes.js` | Public chat and contact endpoints; `/api/admin/*` dashboard endpoints (overview metrics computed from the DB, conversations with audit trail, escalations, knowledge CRUD). |
| `src/auth.js` | Dashboard sign-in: bcrypt passwords, JWT, login rate limit, first owner created from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. |
| `src/widget.js`, `public/widget.js` | Widget settings (publish toggle, name, colour, allowed domains), public config endpoint, and the embeddable script served at `/widget.js`. |
| `test/*.test.js` | API tests: verification, customer isolation, redaction, escalation, auth, widget, and mocked Gemini and Muse tool loops. Run with `npm test`. |

## 2. How the agent works
1. Redact PINs and card numbers from the message.
2. Risk check. Fraud, complaints, card blocking, "send money" and "speak to a human" escalate immediately, with no verification needed.
3. Not verified: account questions start a phone number -> one-time code flow, run by server code, not by the model. Unknown numbers get the same reply as known ones, codes are hashed, expire in 5 minutes and lock after 3 wrong tries.
4. Before verification, greetings, small talk and general questions go to the model in public mode (knowledge search and escalation only). If no model is configured or it fails, scripted replies are used.
5. Verified: the model (Muse, else Gemini, else the rules engine) answers using the read-only tools. If the model fails, the rules engine answers and the fallback is logged.
6. Output is scrubbed, stored, and every tool call, verification, failure and escalation is written to `audit_logs`.

Security properties: identity checks are code not prompts; tools are scoped to the verified customer (tested); no tool moves money or edits records; PINs and card numbers never stored; admin routes require sign-in.

## 3. Front end (`apps/web/src`)
- `api.js`, `auth.jsx`, `pages/Login.jsx`: API client with auth, sign-in page, protected dashboard routes.
- Dashboard pages wired to the API: `Overview` (live metrics, 7/30 day toggle, CSV export), `Conversations` (transcripts and audit log, shows which AI replied), `Escalations` (queue, resolve), `Knowledge` (add/edit/delete, takes effect on the next message), `Demo` (live chat), `Widget` (publish and embed code).
- `Contact` form now saves real leads.
- Widget: `pages/Embed.jsx` (chat inside an iframe), `components/WidgetLoader.jsx`.
- `components/VoiceCall.jsx`: browser voice call. Speech-to-text, then the same chat endpoint, then text-to-speech, turn by turn. English only; Chrome, Edge and Safari; needs HTTPS or localhost.

## 4. Configuration (`apps/api/.env`)
`META_API_KEY` (use Muse), `META_MODEL`, `META_API_BASE`, `META_REASONING_EFFORT`, `GEMINI_API_KEY`, `LLM_PROVIDER` (force one),
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `PUBLIC_API_URL`, `OTP_DEMO`, `BUSINESS_NAME`, `HANDLE_MINUTES`, `CHAT_RATE_LIMIT`, `SEED_HISTORY`.
Never commit `.env` or the `data/` folder (both are git-ignored).

## 5. Known limitations (be honest in the demo)
- All customer data is synthetic. A real bank needs an adapter that calls its API in place of `tools.js`.
- OTP is shown in the chat (`OTP_DEMO=true`); real delivery needs an SMS or email provider. Set `OTP_DEMO=false` in production.
- Voice is a browser, turn-based experience, not a phone line. The browser vendor handles speech recognition. No Bemba or Nyanja speech.
- Single company only (one owner account). No team invites or multi-tenant separation yet.
- Dashboard "hours saved" is an estimate; "AI resolved" means answered without escalation, not customer-confirmed.
- SQLite needs a persistent disk and a single server; use Postgres for scale.
- Muse integration follows Meta's published docs and was tested against a mock; confirm with your real key.

## 6. Run it
```
npm install
cp apps/api/.env.example apps/api/.env   # then add META_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev        # API :4000, web :5173
npm test           # API tests
```
