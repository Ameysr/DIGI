# Digital Heroes

A subscription platform that combines golf score tracking, a monthly prize draw, and charity
giving. Subscribers log their five latest Stableford rounds, those scores become their numbers in
the monthly draw, and a share of every subscription funds a charity they choose.

Built for the Digital Heroes full-stack trainee selection process.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript (client-rendered SPA) |
| Routing / data | React Router v7, TanStack Query v5 |
| Styling | Tailwind CSS v4, Radix primitives |
| Backend | Supabase — Postgres, Row Level Security, Storage |
| Auth | Supabase Auth |
| Payments | Razorpay — auto-renewing subscriptions, plus one-off donations (test mode) |
| Hosting | Vercel (static SPA + five serverless functions) |

**Architecture in one line:** the browser talks to Postgres directly and Row Level Security
authorizes every read and write, including admin actions. Only the five things that need a secret —
subscriptions, donations, the two webhooks, and the monthly cron — go through `/api`.

Read [DECISIONS.md](./DECISIONS.md) for the reasoning, the resolved ambiguities in the brief, and
the known trade-offs.

---

## Quick start

```bash
# 1. Install (see the note below about --include=dev)
npm install --include=dev

# 2. Configure
cp .env.example .env.local
#    ...then fill in the values, following the setup sections below

# 3. Run
npm run dev            # http://localhost:5173
```

With no credentials present the app renders a **configuration checklist** rather than a blank
page, listing exactly which variables are missing.

> **Windows / CI note.** If `NODE_ENV=production` is set in your environment (common on CI images
> and some Windows setups), npm also sets `omit=dev` and will silently prune the entire build
> toolchain on every install — `vite`, `typescript` and `tailwindcss` all disappear. Always use
> `npm install --include=dev`, or unset `NODE_ENV` for local work.

---

## Setup

### 1. Supabase

1. Create a **new** Supabase project.
2. Apply the migrations in order, then the seed:

   ```bash
   # Via the Supabase SQL editor, run each file in turn:
   supabase/migrations/0001_schema.sql
   supabase/migrations/0002_rls.sql
   supabase/migrations/0003_publish.sql
   supabase/migrations/0004_storage.sql
   supabase/seed.sql
   ```

   Or with the Supabase CLI: `supabase db reset` picks up `migrations/` and `seed.sql`
   automatically.

3. From **Project Settings → API**, copy the project URL, the `anon` key, and the
   `service_role` key into `.env.local`.

### 2. Authentication

**Nothing to configure.** Auth is Supabase Auth, built into the project you just created — no
second dashboard, no provider to register, no JWT template, no webhook. Signup, login, sessions and
token refresh are all handled by `supabase-js`.

Profiles are created automatically by an `on_auth_user_created` trigger on `auth.users`, so a new
account has a row the moment it exists.

Two optional settings worth knowing:

- **Confirm email** (Authentication → Sign In / Providers → Email) is often ON for a new project.
  With it on, a signup must click a link before they can sign in. Turn it off for a frictionless
  demo — the accounts in *Test credentials* below were created pre-confirmed, so they work either
  way.
- **Password requirements** are Supabase's defaults; the signup form asks for at least 8 characters.

### 3. Razorpay

The PRD asks for "Stripe (or equivalent PCI-compliant provider)". Stripe India is invite-only, so
Razorpay is used instead — available in India with immediate test mode.

1. Create a Razorpay account and switch the dashboard to **Test mode**.
2. Put your **key id** and **key secret** in `.env.local`.
3. *(Optional)* Create two **subscription plans** (Subscriptions → Plans, or `POST /v1/plans`)
   with amounts matching `api/_lib/pricing.ts` — ₹499 monthly, ₹4,999 yearly — and put their ids in
   `RAZORPAY_PLAN_MONTHLY` / `RAZORPAY_PLAN_YEARLY`. Also set `RAZORPAY_WEBHOOK_SECRET` from a
   webhook at `https://<your-domain>/api/webhooks/razorpay`.

**Step 3 is genuinely optional, and the app tells you which mode you are in.** Razorpay gates the
Subscriptions product behind account activation on some accounts — there, `POST /v1/plans` and
`/v1/subscriptions` return **401** while `/v1/orders` returns **200**. So:

| Plan ids | Mode | Renewal |
|---|---|---|
| set | Razorpay subscription, e-mandate | **Automatic** — Razorpay charges each cycle (§04) |
| unset | one-off order | Manual — the period ends and the subscriber pays again |

Setting the two plan ids later switches modes with **no code change**. `/api/billing` picks the mode
and returns it, so the browser opens the right kind of checkout either way.

### 4. Make yourself an administrator

Profiles are created by the signup trigger and start as `subscriber`. Role changes are blocked for
non-admins by a database trigger, so promote yourself directly:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

Sign out and back in, and an **Admin** entry appears in the sidebar.

---

## Test credentials

Accounts are ordinary Supabase Auth users. Sign up through the app, or create them from
Authentication → Users in the dashboard.

**Two accounts are already provisioned**, so a reviewer can see both sides immediately:

| Role | Email | Password | State |
|---|---|---|---|
| Subscriber | `ranawareamey79+demo@gmail.com` | `Dh-b60a45e376!9` | Active monthly plan, 5 scores (draw-eligible), Greens for Good at 15% |
| Administrator | `ranawareamey79+admin@gmail.com` | `Dh-e4d839aadc!9` | Full admin panel |

Both were created with the address pre-confirmed, so they work even if the project requires email
confirmation. Change either password in the Supabase dashboard.

> **Why a `+` alias?** It is a real, deliverable address that routes to the same inbox, and it avoids
> inventing an address on a domain we do not own — verification mail would otherwise reach a
> stranger.

**Seed data.** `seed.sql` also inserts three placeholder profiles (`user_seed_admin`,
`user_seed_amelia`, `user_seed_raj`) with subscriptions, five scores each, a published draw and a
pending winner claim. They have no matching auth user, so they cannot be logged into — they exist so
the admin analytics, draw history and winner-verification screens have something to show on a fresh
install, and so the pool maths has two subscribers to compute
from.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server, with the `api/` functions mounted (see below) |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Unit tests — draw engine, prize maths, multiset matching, webhook and payment signatures, subscription lapse, error mapping, config guard (94 tests) |
| `npm run test:sql` | Applies the real migrations to a real Postgres and asserts schema, constraints, RLS, the full publish transaction, donations and the signup trigger (53 assertions) |

`npm run test:sql` runs against **PGlite** — Postgres compiled to WebAssembly — so it needs no
Docker daemon or local Postgres. `supabase/test/00_supabase_shim.sql` recreates the small parts of
Supabase a plain Postgres lacks (`auth.jwt()`, the `anon`/`authenticated` roles, `storage`), and
models Supabase's default privileges so the grant assertions are meaningful.

**How `npm run dev` runs the API.** `vite dev` knows nothing about `api/` — that directory is
executed by Vercel's runtime in production — so without help every `/api/*` request 404s locally
and payments can't be tested. `plugins/apiDevServer.ts` mounts those handlers into the dev server,
and bridges `.env.local` into `process.env` for them (Vite only exposes `VITE_`-prefixed values,
and only to the client).

`vercel dev` is the official alternative if you would rather use the real runtime. The plugin is
`apply: 'serve'`, so production builds are untouched and Vercel still runs the functions normally.

---

## How the pieces fit

```
src/
  routes/            marketing · auth · app (subscriber) · admin
  components/        ui primitives · guards · layout · draw · motion
  lib/
    draw/            pure draw engine + prize maths (the tested core)
    hooks/           one module per domain, wrapping Supabase queries
    constants.ts     every business rule in one place
api/                 billing · donations · webhooks/razorpay · cron/draws
supabase/
  migrations/        schema · RLS · publish_draw · storage
  test/              PGlite validation harness
```

**The draw, end to end**

1. A subscriber logs five scores. A trigger silently prunes anything older.
2. An admin schedules the month's draw. Eligibility is active subscription + five scores.
3. The admin chooses random or score-weighted, then **simulates**. Simulation is pure and writes
   nothing, and shows the winning numbers, tier breakdown and payouts.
4. Publishing calls the `publish_draw` RPC with the previewed numbers. In one transaction it
   snapshots the field, scores every entry, computes the pool and tier splits, creates winner
   claims, and carries an unclaimed jackpot forward.
5. Winners upload proof, an admin verifies it, then marks the payout complete. A database trigger
   blocks winners from approving or paying themselves.

**Subscription, end to end**

1. The subscriber picks a plan. `POST /api/billing` creates a Razorpay **subscription** against the
   plan and records the attempt against their profile.
2. The browser opens Razorpay Checkout with the `subscription_id`. Card details go to Razorpay, and
   an e-mandate is registered — that mandate is what makes renewal possible.
3. **The browser does not decide that payment succeeded.** Razorpay's webhook is the only thing that
   changes the status. The client simply refreshes to pick it up.
4. Each cycle Razorpay charges the mandate and sends `subscription.charged`, which moves the period
   forward and writes that cycle's charity contribution to the ledger — keyed on the payment id, so
   a retry cannot double-credit it.
5. A failing mandate sends `halted` (past due) or `cancelled`, so a lapsed subscriber stops being
   entered into the draw without anyone intervening.

**Independent donation, end to end**

Separate from the above, and from the draw — PRD §08.1.

1. On a charity page, `POST /api/donations` with `action: 'create'` makes a Razorpay **order** for a
   one-off amount. Orders rather than subscriptions here, deliberately: a gift is a single charge
   with nothing to renew.
2. The Checkout modal collects it, and the browser posts the result back.
3. `action: 'verify'` recomputes the signature and re-reads the order **from Razorpay** rather than
   trusting the request, then checks the order belongs to the caller.
4. It is recorded in the same contribution ledger as a subscription contribution, tagged
   `source: 'donation'`, so admin totals include it in one `SUM()`.

**A donation never affects the prize pool.** The pool is computed from active subscriptions inside
`publish_draw`, not from the ledger, so a generous donor cannot sway the draw. There is an
assertion for exactly this.

---

## Deployment

1. Push to a new repository and import it into a **new Vercel account**.
2. Vercel detects Vite; `vercel.json` supplies the SPA rewrite (so client routes survive a hard
   refresh) and the monthly cron schedule.
3. Add every variable from `.env.example` in **Project → Settings → Environment Variables**.
   Remember the `VITE_` prefix on client values — without it Vite will not expose them and the app
   shows the configuration checklist.
4. Set `SITE_URL` to the deployed origin.
5. Point the Razorpay webhook at the production URL, if you are in subscription mode.

The cron runs at 06:00 on the first of each month and creates a draft draw for the month ahead, so
an admin always has one ready to configure.

---

## Verification

Automated coverage targets the highest-risk logic — the arithmetic that decides money and the
database rules that cannot be bypassed:

- **Unit (94 tests).** Rolling five-score retention, duplicate-date rejection, score range,
  random draw uniformity, frequency weighting, multiset match counting, tier splits summing
  exactly to the pool, jackpot rollover, database-error translation, the missing-config screen,
  subscription lapse derivation, and both signature checks — webhook HMAC over the raw body, and
  the order/payment signature — including that a signature for a different payment id or a
  different order is rejected.
- **Database (53 assertions).** Applied to real Postgres: constraints and triggers, the role
  escalation guard, RLS isolation for subscribers and anonymous visitors, `publish_draw`
  authorization and validation, the committed pool maths, self-approval being blocked, proof
  storage isolation, and donations — recorded against the donor with no subscription, refusable as
  duplicates, and unable to inflate the prize pool.

The manual pass mirrors PRD § 16.1 — signup, both plans, rolling score entry, simulate and
publish, charity totals against the ledger, proof upload and payout, then responsive and error
paths.

The pool maths in `publish_draw` is verified against a hand-computed expectation: with the seed
data (one monthly subscriber at ₹499 and one yearly at ₹4,999) the monthly-normalised revenue is
₹915.58, so the pool is ₹457.79, splitting to ₹183.11 / ₹160.22 / ₹114.46.
