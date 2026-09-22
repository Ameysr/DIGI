-- ===========================================================================
-- Independent donations
--
-- PRD §08.1 requires a contribution route that is "not tied to gameplay": a
-- one-off gift to a charity, separate from the subscription and from the draw.
--
-- Donations are recorded in the SAME ledger as subscription contributions rather
-- than a parallel table. That is deliberate: the admin dashboard reports "charity
-- contribution totals", and one ledger means that figure is a single SUM() that
-- cannot drift or forget a source. The `source` column is what distinguishes
-- them.
--
-- Note that donations deliberately do NOT feed the prize pool. That is computed
-- from active subscriptions in `publish_draw`, not from this table, so a gift can
-- never inflate the draw.
-- ===========================================================================

do $$ begin
  create type contribution_source as enum ('subscription', 'donation');
exception when duplicate_object then null; end $$;

alter table charity_contributions
  add column if not exists source contribution_source not null default 'subscription';

create index if not exists charity_contributions_source_idx
  on charity_contributions (source, created_at desc);

-- A donation has no subscription behind it, so subscription_id stays null for
-- those rows. It is already nullable, which is why no change is needed here.
comment on column charity_contributions.subscription_id is
  'Set for subscription contributions; null for independent donations.';
