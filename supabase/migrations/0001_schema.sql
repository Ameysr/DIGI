-- ===========================================================================
-- Digital Heroes — schema
--
-- Identity note: this project uses Clerk, not Supabase Auth. There is no
-- auth.users table, so a profile is keyed by the Clerk user id (a text value
-- like 'user_2abc...') and is created by the Clerk webhook rather than by a
-- trigger on auth.users.
-- ===========================================================================

-- gen_random_uuid() is built into Postgres 13+, so no pgcrypto extension is
-- needed (Supabase runs 15+).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('subscriber', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_type as enum ('monthly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sub_status as enum ('inactive', 'active', 'past_due', 'cancelled', 'lapsed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type draw_type as enum ('random', 'algorithmic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type draw_status as enum ('draft', 'simulated', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prize_tier as enum ('5_match', '4_match', '3_match');
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type webhook_provider as enum ('razorpay', 'clerk');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Identity helpers
--
-- Supabase third-party auth puts the Clerk user id in the JWT `sub` claim.
-- `auth.jwt()` returns NULL for the service role and for anonymous requests,
-- which is why both helpers tolerate NULL rather than erroring.
-- ---------------------------------------------------------------------------
create or replace function auth_user_id() returns text
  language sql stable
  as $$
    select nullif(coalesce(auth.jwt() ->> 'sub', ''), '')
  $$;

create or replace function set_updated_at() returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at := now();
    return new;
  end $$;

-- ---------------------------------------------------------------------------
-- Charities
-- ---------------------------------------------------------------------------
create table if not exists charities (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  short_blurb   text not null default '',
  description   text not null default '',
  image_url     text,
  logo_url      text,
  website_url   text,
  is_featured   boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A real table rather than a JSON column so upcoming events can be filtered and
-- paginated by date.
create table if not exists charity_events (
  id          uuid primary key default gen_random_uuid(),
  charity_id  uuid not null references charities(id) on delete cascade,
  title       text not null,
  description text not null default '',
  starts_at   timestamptz not null,
  location    text,
  created_at  timestamptz not null default now()
);

create index if not exists charity_events_charity_starts_idx
  on charity_events (charity_id, starts_at);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with a Clerk user)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id                 text primary key,
  email              text not null,
  full_name          text,
  role               user_role not null default 'subscriber',
  charity_id         uuid references charities(id) on delete set null,
  charity_percentage numeric(5, 2) not null default 10
                       check (charity_percentage >= 10 and charity_percentage <= 50),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Reads profiles, so it must be declared after the table exists.
create or replace function is_admin() returns boolean
  language sql stable security definer
  set search_path = public
  as $$
    select exists (
      select 1 from profiles
      where id = auth_user_id() and role = 'admin'
    )
  $$;

-- Escalation guard. RLS restricts *which rows* a user may write, not *which
-- columns*, so without this a subscriber could promote themselves to admin with
-- a single UPDATE. A NULL auth_user_id means the service role (webhooks, cron),
-- which is trusted and must be allowed to set roles.
create or replace function guard_profile_role() returns trigger
  language plpgsql
  as $$
  begin
    if auth_user_id() is null or is_admin() then
      return new;
    end if;

    if tg_op = 'INSERT' and new.role <> 'subscriber' then
      raise exception 'cannot self-assign the % role', new.role using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'role cannot be changed by the account holder' using errcode = '42501';
    end if;

    return new;
  end $$;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
  before insert or update on profiles
  for each row execute function guard_profile_role();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Subscriptions (1:1 with a profile). Written only by the payment webhook.
--
-- Column names are deliberately provider-neutral: the gateway is Razorpay here,
-- but nothing in the schema or the policies assumes that.
--
-- `amount_cents` holds the smallest unit of the billing currency — paise for
-- INR, exactly as cents work for USD. Amounts are never stored as decimals.
-- ---------------------------------------------------------------------------
create table if not exists subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null unique references profiles(id) on delete cascade,
  provider                 text not null default 'razorpay',
  plan                     plan_type not null,
  status                   sub_status not null default 'inactive',
  amount_cents             integer not null check (amount_cents >= 0),
  provider_customer_id     text,
  -- The provider's reference for the arrangement that granted the current paid
  -- period. With the one-off order flow this holds a Razorpay order id
  -- (order_xxx); with a subscription-based gateway it would hold a
  -- subscription id. Kept provider-neutral on purpose.
  provider_subscription_id text unique,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  -- Set when the subscriber cancels. Access continues until current_period_end,
  -- so the UI can say "ends on <date>" rather than silently going inactive.
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_status_idx on subscriptions (status);

drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Scores
-- ---------------------------------------------------------------------------
create table if not exists scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references profiles(id) on delete cascade,
  value      integer not null check (value between 1 and 45),
  played_on  date not null,
  created_at timestamptz not null default now(),

  -- One score entry per date. Edits are UPDATEs; a second insert for the same
  -- date is rejected here rather than trusted to the client.
  unique (user_id, played_on)
);

create index if not exists scores_user_played_idx
  on scores (user_id, played_on desc, created_at desc);

-- Future rounds are impossible. This cannot be a CHECK constraint because
-- CURRENT_DATE is not immutable.
create or replace function reject_future_score() returns trigger
  language plpgsql
  as $$
  begin
    if new.played_on > current_date then
      raise exception 'a score cannot be dated in the future' using errcode = '22007';
    end if;
    return new;
  end $$;

drop trigger if exists scores_reject_future on scores;
create trigger scores_reject_future
  before insert or update on scores
  for each row execute function reject_future_score();

-- Rolling retention: only the newest five scores survive, so a sixth entry
-- silently replaces the oldest. Enforced in the database because the invariant
-- must hold no matter which client (or which future feature) wrote the row.
create or replace function enforce_score_limit() returns trigger
  language plpgsql
  as $$
  begin
    delete from scores
    where user_id = new.user_id
      and id not in (
        select id from scores
        where user_id = new.user_id
        order by played_on desc, created_at desc
        limit 5
      );
    return null;
  end $$;

drop trigger if exists scores_enforce_limit on scores;
create trigger scores_enforce_limit
  after insert on scores
  for each row execute function enforce_score_limit();

-- ---------------------------------------------------------------------------
-- Charity contributions (append-only ledger for reporting)
-- ---------------------------------------------------------------------------
create table if not exists charity_contributions (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null references profiles(id) on delete cascade,
  charity_id      uuid references charities(id) on delete set null,
  subscription_id uuid references subscriptions(id) on delete set null,
  amount_cents    integer not null check (amount_cents >= 0),
  period_month    date not null,
  -- The gateway's payment id, so a webhook retry cannot double-credit the ledger.
  provider_payment_id text unique,
  created_at      timestamptz not null default now()
);

create index if not exists charity_contributions_user_idx
  on charity_contributions (user_id, period_month desc);
create index if not exists charity_contributions_charity_idx
  on charity_contributions (charity_id);

-- ---------------------------------------------------------------------------
-- Draws
-- ---------------------------------------------------------------------------
create table if not exists draws (
  id                uuid primary key default gen_random_uuid(),
  draw_month        date not null unique,
  draw_type         draw_type not null default 'random',
  status            draw_status not null default 'draft',
  winning_numbers   integer[],
  subscriber_count  integer not null default 0,
  total_pool_cents  bigint not null default 0,
  rollover_in_cents bigint not null default 0,
  rollover_out_cents bigint not null default 0,
  published_at      timestamptz,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A draw is always identified by the first of its month.
  constraint draws_month_is_first check (extract(day from draw_month) = 1),
  constraint draws_numbers_length check (
    winning_numbers is null or array_length(winning_numbers, 1) = 5
  )
);

drop trigger if exists draws_set_updated_at on draws;
create trigger draws_set_updated_at
  before update on draws
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Draw entries — the snapshot of who played what, and what they won
-- ---------------------------------------------------------------------------
create table if not exists draw_entries (
  id            uuid primary key default gen_random_uuid(),
  draw_id       uuid not null references draws(id) on delete cascade,
  user_id       text not null references profiles(id) on delete cascade,
  numbers       integer[] not null,
  matched_count integer not null default 0,
  prize_tier    prize_tier,
  prize_cents   bigint not null default 0,
  created_at    timestamptz not null default now(),

  unique (draw_id, user_id),
  constraint draw_entries_numbers_length check (array_length(numbers, 1) = 5)
);

create index if not exists draw_entries_draw_idx on draw_entries (draw_id);
create index if not exists draw_entries_user_idx on draw_entries (user_id);

-- ---------------------------------------------------------------------------
-- Winners — verification and payout
-- ---------------------------------------------------------------------------
create table if not exists winners (
  id               uuid primary key default gen_random_uuid(),
  draw_id          uuid not null references draws(id) on delete cascade,
  user_id          text not null references profiles(id) on delete cascade,
  draw_entry_id    uuid references draw_entries(id) on delete set null,
  prize_tier       prize_tier not null,
  prize_cents      bigint not null default 0,
  proof_path       text,
  review_status    review_status not null default 'pending',
  payment_status   payment_status not null default 'pending',
  rejection_reason text,
  reviewed_by      text,
  reviewed_at      timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (draw_id, user_id)
);

create index if not exists winners_review_idx on winners (review_status, payment_status);

-- A winner may upload proof of their own scores, but must never be able to mark
-- their own claim approved or paid.
create or replace function guard_winner_privileged_fields() returns trigger
  language plpgsql
  as $$
  begin
    -- NULL auth_user_id is the service role; RLS has already denied everyone else.
    if auth_user_id() is null or is_admin() then
      return new;
    end if;

    if new.prize_tier        is distinct from old.prize_tier
      or new.prize_cents     is distinct from old.prize_cents
      or new.review_status   is distinct from old.review_status
      or new.payment_status  is distinct from old.payment_status
      or new.reviewed_by     is distinct from old.reviewed_by
      or new.reviewed_at     is distinct from old.reviewed_at
      or new.paid_at         is distinct from old.paid_at
      or new.rejection_reason is distinct from old.rejection_reason
    then
      raise exception 'only administrators may change review or payment state'
        using errcode = '42501';
    end if;

    return new;
  end $$;

drop trigger if exists winners_guard_privileged on winners;
create trigger winners_guard_privileged
  before update on winners
  for each row execute function guard_winner_privileged_fields();

drop trigger if exists winners_set_updated_at on winners;
create trigger winners_set_updated_at
  before update on winners
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Webhook idempotency. A primary-key conflict means "already processed", so a
-- provider retry can never double-credit the contribution ledger.
-- ---------------------------------------------------------------------------
create table if not exists webhook_events (
  id           text primary key,
  provider     webhook_provider not null,
  type         text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log for privileged actions
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);
