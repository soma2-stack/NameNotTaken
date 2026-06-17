# handle-check

A fast, mobile-first **username availability checker**. Type a handle once and
see whether it's free across GitHub, Reddit, YouTube, TikTok, X, Instagram,
Threads, and Twitch — all checked concurrently.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**. No database,
deploys to Vercel with zero configuration.

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

**Tier B — best-effort** (TikTok, X, Instagram, Threads, Twitch): these
platforms aggressively block automated requests. The checker **never guesses** —
if a request is blocked, rate-limited, or ambiguous it returns `unknown` so you
can verify manually via the profile link.

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

This app is zero-config on Vercel.

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and **import** the repo.
3. Framework preset auto-detects **Next.js** — accept the defaults.
4. *(Optional)* Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` under
   **Settings → Environment Variables** to enable the real Twitch check.
5. Click **Deploy**.

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
