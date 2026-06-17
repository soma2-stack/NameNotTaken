# AvailifyAi

A fast, mobile-first **username availability checker**. Type a handle once and
see whether it's free across major social apps, creator platforms, developer
sites, and matching domains.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**. The checker
itself needs no database or config; accounts and payments add [Clerk](https://clerk.com)
+ [Stripe](https://stripe.com) (still no database — the plan lives in Clerk user
metadata). Deploys to Vercel.

## Product tiers

**Free ($0/mo)**

- 3 searches total.
- Basic availability check only.
- .com domain result.

**Pro ($10/mo)**

- Unlimited searches.
- AI Name Assistant for brainstorming and picking stronger names.
- Bulk Domain Checker for up to 20 names at once.
- Instant TLD checks for .com, .ai, .io, .net, and .co.
- Watchlist and alerts for saved favorite names.

**Business ($29/mo)**

- Everything in Pro.
- More advanced brand reports.
- Higher limits.
- Team-friendly use.
- Priority support.

---

## Accounts & payments (real per-user gating)

Paid tiers are gated **per user**: visitors sign in with [Clerk](https://clerk.com),
pay through **server-side Stripe Checkout**, and a **Stripe webhook** writes the
resulting plan onto the user's Clerk account. The server reads that plan on every
request, so the unlocked state cannot be faked from the browser. **No separate
database** is needed — Clerk user metadata stores the plan.

> ⚠️ The Stripe **secret key**, **webhook secret**, and **price IDs** are
> server-only. Put them in environment variables — never in the repo, in
> client code (`NEXT_PUBLIC_…`), or in chat.

### How it fits together

| Piece | File |
| ----- | ---- |
| Plan + entitlement model | [`lib/billing.ts`](lib/billing.ts) |
| Read the caller's plan (server) | [`lib/plan.ts`](lib/plan.ts) |
| Lazy Stripe client | [`lib/stripe.ts`](lib/stripe.ts) |
| Attach Clerk auth to requests | [`middleware.ts`](middleware.ts) |
| Start a subscription | `POST` [`app/api/checkout/route.ts`](app/api/checkout/route.ts) |
| Apply plan on payment events | `POST` [`app/api/stripe/webhook/route.ts`](app/api/stripe/webhook/route.ts) |
| Self-serve cancel/upgrade | `POST` [`app/api/billing-portal/route.ts`](app/api/billing-portal/route.ts) |
| Expose plan to the UI | `GET` [`app/api/me/route.ts`](app/api/me/route.ts) |
| Enforce premium TLDs | [`app/api/check/route.ts`](app/api/check/route.ts) |

The premium TLD checks (`.ai`, `.io`, `.net`, `.co`) are stripped from the
`/api/check` response for free plans, so the paid data never reaches an
unentitled client. AI assistant and watchlist are client features unlocked by
the verified plan returned from `/api/me`.

### One-time setup

1. **Clerk** — create a free app at [dashboard.clerk.com](https://dashboard.clerk.com),
   then set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
2. **Stripe products** — in the [Stripe Dashboard](https://dashboard.stripe.com/),
   create two products with recurring monthly prices: **Pro** ($10/mo) and
   **Business** ($29/mo). Copy each **price ID** (`price_…`) into
   `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID`.
3. **Stripe secret key** — set `STRIPE_SECRET_KEY` (use a `sk_test_…` key in dev).
4. **Webhook** — add an endpoint at `https://YOUR_DOMAIN/api/stripe/webhook`
   subscribed to `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.
5. **Base URL** — set `NEXT_PUBLIC_APP_URL` to your deployed origin (used for
   Checkout success/cancel URLs).

See [`.env.example`](.env.example) for the full list. On Vercel, add all of the
above under **Settings → Environment Variables**, then redeploy.

### Testing locally

```bash
cp .env.example .env.local   # fill in Clerk + Stripe test values

# Forward Stripe webhooks to your dev server and grab the signing secret:
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET, then:
npm run dev
```

Use Stripe's test card `4242 4242 4242 4242` (any future expiry / CVC) to
complete a subscription, then watch the plan flip to Pro/Business in the app.

---

## How it works

The page calls a single serverless route, `GET /api/check?username=X`, which
fans out to one adapter per platform. Each adapter runs concurrently with a
hard **5-second timeout** and a realistic browser `User-Agent`. The API returns:

```json
[
  {
    "platform": "GitHub",
    "status": "available",
    "checkedVia": "GitHub API",
    "profileUrl": "https://github.com/example"
  }
]
```

`status` is one of:

| Status        | UI color | Meaning                                                      |
| ------------- | -------- | ------------------------------------------------------------ |
| `available`   | 🟢 green  | The handle is free.                                          |
| `taken`       | 🔴 red    | The handle is in use.                                        |
| `unknown`     | ⚪ grey   | Couldn't determine — use the **Open ↗** link to verify by hand. |

### Tiers

**Tier A — real checks** (authoritative):

- **GitHub** — `GET api.github.com/users/{u}` → `404` available, `200` taken.
- **Reddit** — `GET reddit.com/user/{u}/about.json` → missing/error body
  available, valid account taken.
- **YouTube** — `GET youtube.com/@{u}` → `404` available, channel page taken.
  Guards against soft-`200` error pages.
- **Domains** — DNS checks for `.com`, `.ai`, `.io`, `.net`, and `.co`.

**Tier B — best-effort/manual checks** (TikTok, X, Instagram, Threads, Twitch,
Facebook, Snapchat, Pinterest, LinkedIn, Steam, Spotify, SoundCloud, Roblox,
Telegram, Medium, Substack, GitLab, and Discord): these platforms often block
automated requests or do not expose reliable public username APIs. The checker
**never guesses** — if a request is blocked, rate-limited, ambiguous, or needs an
in-app lookup, it returns `unknown` so you can verify manually via the profile
link.

- **Twitch** is a *real* check when `TWITCH_CLIENT_ID` and
  `TWITCH_CLIENT_SECRET` are set (via the Helix API); otherwise it returns
  `unknown`.

### Validation

Each platform has its own handle rules (length + allowed characters). If a
username can't be valid on a platform, the network call is skipped and the row
reports `unknown` with reason `invalid format`.

### Caching

Optional in-memory TTL cache (5 min) avoids re-hitting upstreams for repeated
lookups on a warm instance. `unknown` results are never cached. There is no
database and nothing is persisted.

---

## Local development

Requires **Node.js 18.17+**.

```bash
# 1. Install dependencies
npm install

# 2. (optional) enable the real Twitch check
cp .env.example .env.local
# then fill in TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

---

## Deploy to Vercel

The checker deploys with no config; accounts and payments need their env vars set.

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and **import** the repo.
3. Framework preset auto-detects **Next.js** — accept the defaults.
4. Add the **Clerk** and **Stripe** environment variables (see
   [Accounts & payments](#accounts--payments-real-per-user-gating)) under
   **Settings → Environment Variables** to enable sign-in and paid plans.
5. *(Optional)* Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` to enable the
   real Twitch check.
6. Click **Deploy**.

Or with the CLI:

```bash
npm i -g vercel
vercel        # preview deploy
vercel --prod # production deploy
```

The API routes run as serverless functions automatically — no extra setup.

---

## Notes & limitations

- Tier B results are intentionally conservative. A `taken`/`available` verdict
  there means the platform gave an unambiguous signal; otherwise you'll see
  `unknown`. This avoids false positives from login walls and JS-only pages.
- Availability is a best-effort snapshot, not a reservation. Always confirm on
  the platform itself before relying on a handle.
- All network failures degrade gracefully to `unknown` — the app never crashes
  on a bad upstream.

## Project structure

```
app/
  api/check/route.ts     # GET /api/check?username=X
  components/ResultRow.tsx
  layout.tsx
  page.tsx               # the UI
lib/
  platforms.ts           # one adapter function per platform
  check.ts               # concurrent orchestration + per-adapter safety
  validation.ts          # per-platform handle rules
  http.ts                # fetch with timeout + User-Agent
  cache.ts               # optional in-memory TTL cache
  types.ts
```
