# Companies (multi-tenant)

Any company can sign up at `/signup`. Each gets its own workspace: knowledge base, widget key, conversations,
escalations, lookups and team login. Nothing is shared between companies.

## How it works
- `companies` table. **Company 1** is your original business (demo bank data and OTP verification, "sample" mode).
  New signups are "standard": the AI answers from their knowledge base, can run their own lookups, and escalates to a human.
- Every dashboard query filters on the signed-in user's company. Chats belong to the company whose widget key started them.
- Signed-in owners can preview their own AI from **Live demo** before publishing. Visitors need a published widget key.
- Only company 1 can see marketing leads or reset demo data.
- Set `SIGNUP_ENABLED=false` to close sign-up.

## Lookups (connect their systems)
A company adds `GET https://api.theirshop.com/orders/{order_id}` in **Lookups**, optionally with an auth header, and
lists the fields the AI may share. The AI can then answer "where is order 1234?".

Safety, enforced in code (`customtools.js`):
- HTTPS only; addresses are checked again at connect time, so localhost, private ranges and cloud metadata are refused
- no redirects, 100 KB response cap, 6 s timeout, 10 lookups per chat, runs through the job queue
- only allow-listed fields are returned, the secret is encrypted at rest (`SECRETS_KEY`, else derived from the JWT secret) and never sent back to the browser
- customers are not signed in: tell companies to expose only safe fields (status, dates), never personal data

`ALLOW_PRIVATE_CONNECTORS=true` turns the address checks off for local testing. Never set it in production.

## Not built yet
Customer verification for company lookups (OTP through the company's own customer API), per-company usage limits,
teammates per company, billing, email notification of escalations.
