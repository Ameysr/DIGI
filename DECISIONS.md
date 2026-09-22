# Decisions

Two kinds of decision are recorded here: the **ambiguities** in the brief that had to be
resolved before anything could be built, and the **engineering trade-offs** made along the way.

---

## Part 1 — Ambiguities in the brief

The PRD says "ambiguity is part of the test", so each of these is a judgement call, stated
plainly with the reasoning and the alternative.

### 1. What numbers does a subscriber actually play?

**Decision: their latest five Stableford scores.** Five scores are also the eligibility
requirement — a subscriber with four scores is not entered at all.

The PRD says players "must enter their last 5 golf scores", that scores are Stableford values
1–45, and that draws are "5-number match / 4-number / 3-number". Those three facts only cohere
under one reading: the scores *are* the numbers. The alternative — a separate number-picking
step — would make score entry decorative, and would leave the 1–45 range unexplained.

The useful consequence is that the five-score requirement becomes load-bearing rather than
cosmetic: it is the entry ticket.

### 2. What happens when a player's five scores contain duplicates?

**Decision: match counting treats the five numbers as a multiset.**

Two rounds of 30 in your last five is entirely normal. Against a draw containing one 30, that is
**one** match, not two — each occurrence in the winning set can only be consumed once.

Implemented as a real multiset intersection in both languages: `countMatches()` in
`src/lib/draw/match.ts`, and a per-value occurrence join in `publish_draw()`. Both are tested,
including the case that a global rank would get wrong.

### 3. What does "algorithmic — weighted by score frequency" mean?

**Decision: weighted sampling without replacement over 1–45, where each number's weight is how
often it was scored across that month's eligible entries, with a floor weight so every number
stays reachable.**

Score frequency is the only signal the platform holds — it has no other per-number data — so
this is the faithful reading. The floor matters: without it, numbers nobody happened to score
would be unreachable, and the draw would become deterministic rather than weighted.

### 4. How is the prize pool funded, and where does the charity money come from?

**Decision: 50% of each payment funds the prize pool, the subscriber's chosen percentage (10–50%)
goes to their charity, and the platform keeps the remainder. Charity is taken out of the
platform's share, not out of the pool.**

- Monthly £9.99 / yearly £79.99
- Prize pool: 50% of the monthly-normalised subscription revenue
- Charity: the subscriber's chosen percentage, 10% minimum
- Platform: whatever is left

Taking charity from the platform half means the two can never over-allocate and the pool stays
predictable. It also justifies the 50% ceiling on `charity_percentage`: above that, the platform
share would go negative.

**Yearly plans are normalised to a twelfth of their price** when computing the pool. Without
that, a single yearly signup would inflate one month's pool twelvefold and then contribute
nothing for eleven months.

### 5. How do the tiers split, and what rolls over?

**Decision: 40% / 35% / 25% for 5-, 4- and 3-number matches. Only the unclaimed jackpot rolls
over.**

The PRD marks rollover "Yes — jackpot" for the 5-match tier only. Prizes split equally within a
tier, rounded down, with the remainder returning to the pool rather than being distributed
unevenly.

The two headline tiers floor and the lowest tier absorbs the rounding remainder, so tier amounts
always sum exactly to the pool. **This rule is implemented twice — in `splitTiers()`
(TypeScript) and in `publish_draw()` (SQL) — and the two must agree**, or an admin's simulation
will disagree with the committed draw. Both files carry a comment saying so.

### 6. What does "real-time subscription status check on every authenticated request" require?

**Decision: a guard that re-evaluates on every navigation, backed by a query with a short stale
time that refetches on window focus and reconnect.**

The literal reading — a database round trip before every request — would be wasteful and the
perceived benefit is nil. The intent is that a cancellation or renewal shows up promptly without
a manual reload. With Razorpay driving state changes through webhooks, focus/reconnect refetching
achieves that. There is deliberately no polling loop.

---

## Part 2 — Engineering decisions

### Integrity rules live in Postgres, not in the app

The score range, the one-score-per-date rule, the keep-only-the-latest-five rule, and the
admin-only winner transitions are all enforced by constraints and triggers.

This matters more here than in a server-rendered app. A client-rendered SPA talks to the database
directly, so there is no server tier in which to hide a rule — the database *is* the trust
boundary. A tampered client cannot store a score of 900, cannot log two rounds on one date, and
cannot accumulate a sixth score.

The rolling window is a trigger rather than application logic:

```sql
DELETE FROM scores
WHERE user_id = NEW.user_id
  AND id NOT IN (
    SELECT id FROM scores WHERE user_id = NEW.user_id
    ORDER BY played_on DESC, created_at DESC LIMIT 5
  );
```

### RLS is the only authorization layer

Every table has RLS enabled. The architecture is deliberately shaped around that fact:

| Path | Used for | Enforcement |
|---|---|---|
| Browser → Supabase | All CRUD, including admin mutations | RLS policies |
| Browser → `/api/*` (5 endpoints) | Razorpay, cron | Supabase JWT, provider signatures, service role |

Admin mutations (publish a draw, review a winner, mark paid) go **directly to the database** and
are authorized by RLS admin policies rather than through an API endpoint. That keeps the API
surface tiny and means there is exactly one place authorization can be wrong — the policies —
instead of two that must agree.

The API functions are only the things that genuinely need a secret or the service role.

### Privileges are tightened beyond Supabase's defaults

Supabase grants `anon` and `authenticated` broad table privileges by default and relies on RLS
alone to filter. Here the grants are narrowed too: `anon` holds **`SELECT` only**, on exactly three
tables — `charities`, `charity_events` and `draws`.

This is defence in depth, and it changes a failure mode for the better. An accidental
unauthenticated read of `profiles` raises **`42501 permission denied for table profiles`** instead
of quietly returning zero rows — which is far easier to diagnose than an empty screen. See the next
point for why that matters.

**This was initially wrong, and worth recording.** Supabase sets *default privileges* so that every
new table in `public` is granted **ALL** to `anon` and `authenticated` at creation time. A `grant`
statement can therefore only ever add; it cannot narrow. The first version of the migration granted
the three public tables and claimed the result was a tightened model — but `anon` in fact retained
SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES on every table, and RLS was doing
all the work. This was confirmed by querying `information_schema.role_table_grants` against the real
project, which showed all seven privileges on `profiles`.

The fix is an explicit `revoke all on all tables in schema public from anon` before re-granting the
three. The same bug also hid in the test harness: the PGlite shim did not model Supabase's default
privileges, so `anon` genuinely lacked SELECT there and the assertion "anonymous cannot read
profiles" passed for the wrong reason — it would have kept passing even if the revoke were deleted.
The shim now sets the same default privileges before the migrations run, and the assertion has been
confirmed to fail when the revoke is removed.

The general lesson: **a test harness that diverges from production in the direction of being more
restrictive will produce false confidence**, because it fails closed on exactly the mistakes you are
trying to catch.

### Identity is Supabase Auth, after an external provider proved unconfigurable

**The brief does not mandate a provider** — it says only "Backend connected (e.g. Supabase)". The
first version used Clerk with Supabase's third-party auth integration, and that was a mistake worth
recording in full.

**Why it was changed.** Supabase only accepts an external provider's tokens once that provider is
registered in the dashboard, where Supabase is given the issuer URL so it can fetch the JWKS. If
that is not done, Supabase cannot decode the token **at all** and every request is treated as
anonymous. There is no partial state and no warning — the app simply looks like it has no data.

The failure was confirmed from the command line, not guessed at. Minting a real token for a real
account and calling Supabase returned:

```
401 {"code":"PGRST301","message":"No suitable key or wrong key type"}
```

`"No suitable key was found to decode the JWT"` — the signature of a missing integration, and
distinguishable from `42501`, which is what a *decodable* token gets when a policy denies it.

The integration was never configured, and it was not something the code could work around: the
database access token available here has no config scope (it returns 403 on every `/v1/projects`
endpoint), and the dashboard is the only other route. Having built the whole platform on an
identity provider whose integration needs a manual step that could not be completed was the actual
mistake.

**What the swap cost, and what it saved.** Supabase Auth is native, so there is now nothing to
configure: no provider registration, no JWKS, no JWT template, no webhook, no second dashboard, and
no CDN dependency for the browser to fail to load. Identity, session refresh and token validation
are all the same service that holds the data.

**The RLS layer needed no changes at all.** `auth_user_id()` reads the JWT `sub` claim:

```sql
select nullif(coalesce(auth.jwt() ->> 'sub', ''), '')
```

That is provider-agnostic, and Supabase Auth populates the same claim. Every policy, grant and
foreign key kept working untouched — the whole migration is a profile-creation trigger. Not naming
a provider anywhere in the schema is what made that true, and it is the reason the swap took an
afternoon rather than a rewrite.

**The cost is honest and visible.** Clerk's hosted sign-in, MFA and verification screens are gone;
sign-in and sign-up are now two small forms in `src/routes/auth/`. For an assignment submitted to a
deadline, "no configuration required" is worth more than a nicer auth UI that needs a dashboard step
nobody can find.

### The draw algorithm exists once, in TypeScript

`publish_draw(p_draw_id, p_winning_numbers)` receives the winning numbers rather than generating
them. The algorithm lives in `src/lib/draw/engine.ts`, where it uses `crypto.getRandomValues` and
is unit-tested.

Two reasons. First, reimplementing it in plpgsql would mean two implementations that must agree
forever. Second, Postgres's `random()` is not a cryptographically sound source for a decision
that moves money — `Math.random` is avoided for the same reason.

The SQL function validates what it is given: exactly five numbers, all distinct, all within 1–45.
Generation in trusted code, validation and commit in the database, all in one transaction.

### Simulation and publish share one engine

The admin simulator runs the same pure functions the publish path is modelled on, reading the
eligible field through the admin RLS policy. Because simulation is pure and writes nothing, an
admin can run it repeatedly and then publish *exactly the numbers they previewed* — the preview
is not a separate estimate.

### The payment gateway is Razorpay, behind a narrow seam

**The brief allows this.** The PRD specifies "Stripe (or equivalent PCI-compliant provider)".
Stripe India is invite-only, and test mode still requires an account, so Stripe test credentials
were simply unobtainable. Razorpay is the equivalent provider, free to open in India with
immediate test mode, and was chosen as the replacement — not as a workaround, but as the option
the brief explicitly permits.

Three decisions inside that swap are worth recording:

**Auto-renewing subscriptions, because the PRD requires renewal.** The plan flow uses Razorpay
*subscriptions*: Razorpay holds an e-mandate and charges each cycle itself, and its lifecycle events
drive our status. That is what makes §04's "renewal, cancellation, and lapsed-subscription states"
true rather than imitated.

**…with a single-charge fallback, because the product is gated.** Razorpay does not expose
Subscriptions on every account: on one where it is unavailable, `POST /v1/plans` and
`/v1/subscriptions` both return **401** while `/v1/orders` returns **200** — same credentials, so it
is a product gate rather than a key problem. Enabling it can require completing account activation,
which is not something you can wait on mid-submission.

So the mode is **detected, not configured**: if both plan ids are present the app sells
auto-renewing subscriptions; otherwise it falls back to one-off orders. `/api/billing` chooses and
returns the mode, and the browser opens the corresponding checkout. Adding the plan ids later is the
entire switch — no code change. The honest cost is that order mode does not renew, which is stated
in the README and in the known limitations rather than glossed over.

**Orders for donations, subscriptions for plans.** The two payment flows deliberately differ.
A donation is a single charge with nothing to renew, so an order is exactly right; a membership
needs a mandate, so it needs a subscription. Using one mechanism for both would have meant either a
mandate nobody needs or a renewal that does not happen.

**The browser never decides a payment succeeded.** For subscriptions the webhook is the only thing
that moves the status — the client's completion callback just refetches. For donations, where there
is no webhook, the callback posts the Razorpay signature and the server recomputes it, then re-reads
the order *from Razorpay* to confirm the amount and owner rather than trusting the request body.

**The seam is narrow, and the schema does not know the gateway.** Billing touches `api/billing.ts`,
`api/donations.ts`, `api/webhooks/razorpay.ts` and the `_lib` helpers, plus the subscribe/donate
buttons. Nothing in the schema, the RLS policies, or the draw engine mentions a provider, and the
column names (`provider_subscription_id`, `provider_payment_id`) stay provider-neutral so a future
swap is a migration of values rather than of structure.

**Currency moved to INR.** Amounts remain integers in the smallest currency unit — paise — which
behaves identically to cents, so every calculation in the draw engine and `publish_draw` is
unchanged. The `_CENTS` naming is kept throughout for consistency; it means "minor unit" here.

**Known duplication:** plan prices exist in three places — the Razorpay plan (what is actually
charged), `src/lib/constants.ts` (what the UI advertises), and `api/_lib/pricing.ts` (what is
recorded on a pending subscription). The API cannot import from `src` because Vercel compiles the
functions separately and does not resolve the `@/` alias, so the duplication is deliberate and
commented in all three. **The Razorpay plan is authoritative for money**; the other two must match
it.

### Donations share the contribution ledger, but not the prize pool

The independent donation option (§08.1) writes into `charity_contributions` with a `source` column,
rather than getting its own table.

That was chosen for the admin reports: §11 asks for "charity contribution totals", and one ledger
means that figure is a single `SUM()` that cannot drift or quietly forget a source. A separate table
would have meant two sums that must agree.

**The important part is what donations do NOT touch.** The prize pool is computed inside
`publish_draw` from active subscriptions, never from the contribution ledger. So a generous donor
cannot inflate the draw or buy themselves a better chance — a property worth stating because the
obvious implementation (sum the ledger) would have got it wrong. There is a database assertion for
exactly this.

### Webhooks and callbacks are idempotent

One webhook remains — Razorpay's — and it records the provider event id in `webhook_events` before
processing. A primary-key conflict means "already handled", so a retry cannot double-apply. If
processing *fails*, the event row is deleted and a 500 is returned, so the retry is processed
rather than silently swallowed — recording first without that rollback is a common bug that loses
events.

(The `webhook_provider` enum still lists `clerk` from when an external auth provider existed. An
unused enum value is harmless and Postgres makes removing one awkward; it is noted here rather than
left to look like an oversight.)

Payment confirmation for one-off charges runs the other way round: it is a callback from the
browser, so it cannot rely on a provider event id. It is made idempotent by the unique constraint on
`charity_contributions.provider_payment_id`. `verify-payment` checks for an existing row first and
treats a duplicate insert as expected rather than exceptional, so a double-submitted handler or a
browser retry cannot extend a subscription twice.

### Aggregates are computed client-side — a known trade-off

The admin overview sums the prize pool, contributions and payouts by reading the relevant rows
and reducing in the browser. At this scale that is fine and avoids bespoke SQL, but it does ship
every row to the client. A production deployment would move these into a materialised view or an
aggregate function. Noted rather than hidden.

---

## Part 3 — Known limitations

- **Razorpay is in test mode.** Going live is a key swap, plus publishing live plans and pointing
  the webhook at production. Stripe was the original choice and was replaced because Stripe India
  is invite-only — the reasoning is in Part 2.
- **Renewal depends on the Razorpay account.** In subscription mode (plan ids set) renewal is
  automatic and the webhook is what activates and renews. In order mode — the fallback for accounts
  where Razorpay gates the Subscriptions product — nothing renews and the subscriber pays again when
  the period ends. `/api/billing` reports which mode is active, and the app never claims renewal it
  cannot deliver.
- **The webhook must be reachable in subscription mode.** Activation is not decided by the browser,
  which is the right design, but it does mean a deployment with a broken webhook endpoint would take
  payments and leave subscriptions inactive. `/api/billing` records the pending subscription first,
  so there is always a row to reconcile.
- **Plan prices live in three places** (`src/lib/constants.ts`, `api/_lib/pricing.ts`, and the
  Razorpay plan itself). The Razorpay plan is authoritative for money.
- **Charity artwork is uploaded and shown on the charity page**, but not on the directory cards —
  the list shows names and blurbs only. The image is uploadable from the admin form (to the public
  `charity-media` bucket, via the file input rather than a pasted URL).
- **No email notifications.** The PRD does not require them.
- **Bundle size.** The initial JS is ~159 KB gzipped. Routes are code-split, which keeps recharts
  (admin only) and the auth screens out of the landing bundle. The remaining chunk is React,
  Supabase, router and query — all needed on first paint.
- **Auth UI is ours, not hosted.** Dropping the external provider removed its prebuilt sign-in,
  MFA and verification screens. Sign-in and sign-up are two small forms, and password-reset is not
  implemented — a reviewer would reset a password from the Supabase dashboard instead.
- **Deleting an auth user does not cascade to their profile.** `profiles.id` is text rather than a
  uuid foreign key to `auth.users`, so the seeded demo profiles can exist without an auth user. The
  consequence is that removing an account leaves its profile and data behind; a production build
  would either add the foreign key or delete through the admin API.
- **`npm install` needs `--include=dev` on machines with `NODE_ENV=production`**, or npm prunes
  the entire build toolchain. Documented in the README.
