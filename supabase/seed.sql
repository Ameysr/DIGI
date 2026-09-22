-- ===========================================================================
-- Digital Heroes — seed data
--
-- Provides the charity directory (which is real, public content) plus a small
-- body of demo data so the user and admin dashboards have something to show on
-- first run.
--
-- IDENTITY NOTE: profiles are keyed by Clerk user id. The ids below are
-- placeholder stand-ins that will never match a real signup — they exist so the
-- admin analytics, draw history and winner verification screens are not empty.
-- Your own account is created by the Clerk webhook when you sign up; promote it
-- to admin afterwards (see README).
--
-- Idempotent: safe to run repeatedly.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Charities
-- ---------------------------------------------------------------------------
insert into charities (slug, name, short_blurb, description, website_url, is_featured, is_active)
values
  (
    'fairways-for-futures',
    'Fairways for Futures',
    'Opens the game to young people who could never afford to pick up a club.',
    'Fairways for Futures puts equipment, coaching and club membership within reach of teenagers in underserved neighbourhoods. Every pound raised funds a season of weekly coaching, a starter set of clubs, and travel to regional competitions — the three things that most often stop a young player before they begin.',
    'https://example.org/fairways-for-futures',
    true,
    true
  ),
  (
    'greens-for-good',
    'Greens for Good',
    'Funds mental health support for people rebuilding after a crisis.',
    'Greens for Good pays for counselling sessions for adults recovering from bereavement, addiction and long-term illness. Their model pairs every participant with a weekly group session outdoors, because they found that recovery sticks when it happens alongside other people rather than in a waiting room.',
    'https://example.org/greens-for-good',
    false,
    true
  ),
  (
    'swing-against-hunger',
    'Swing Against Hunger',
    'Turns a monthly entry into meals for families in the same community.',
    'Swing Against Hunger runs a network of local food hubs supplying fresh produce to families referred by schools and health visitors. They prioritise fresh food over tinned goods, and they buy locally wherever the budget allows so the money circulates twice.',
    'https://example.org/swing-against-hunger',
    false,
    true
  ),
  (
    'birdies-for-bravery',
    'Birdies for Bravery',
    'Funds play therapy and family accommodation at children''s hospitals.',
    'Birdies for Bravery keeps families close to their children during long hospital stays. The charity funds overnight accommodation near paediatric wards, and play therapy that gives children a way to process treatment that does not depend on finding the words for it.',
    'https://example.org/birdies-for-bravery',
    false,
    true
  ),
  (
    'blue-water-alliance',
    'Blue Water Alliance',
    'Clears plastic from coastlines and rivers before it reaches the sea.',
    'Blue Water Alliance intercepts plastic at river level, where the concentration is highest and the cost per tonne removed is lowest. They publish removal data every quarter and work with fishing communities to bring recovered plastic back into the supply chain.',
    'https://example.org/blue-water-alliance',
    false,
    true
  ),
  (
    'tee-off-for-trees',
    'Tee Off for Trees',
    'Plants and protects native woodland on former industrial land.',
    'Tee Off for Trees acquires degraded land and returns it to native woodland, planting species chosen for the soil rather than for speed of growth. Each site is maintained for fifteen years, because planting a tree is the easy part.',
    'https://example.org/tee-off-for-trees',
    false,
    true
  )
on conflict (slug) do update
  set name        = excluded.name,
      short_blurb = excluded.short_blurb,
      description = excluded.description,
      is_featured = excluded.is_featured,
      is_active   = excluded.is_active;

-- Upcoming events. Recreated each run so dates stay in the future.
delete from charity_events
where charity_id in (select id from charities where slug in (
  'fairways-for-futures', 'greens-for-good', 'swing-against-hunger',
  'birdies-for-bravery', 'blue-water-alliance', 'tee-off-for-trees'
));

insert into charity_events (charity_id, title, description, starts_at, location)
select c.id, e.title, e.description, e.starts_at, e.location
from charities c
join (values
  ('fairways-for-futures', 'Junior Open Day',        'A free morning of coaching for 12–17s, clubs provided.',                now() + interval '18 days', 'Riverside Golf Centre'),
  ('fairways-for-futures', 'Equipment Drive',        'Donate spare clubs and bags; every set goes to a new player.',          now() + interval '46 days', 'Riverside Golf Centre'),
  ('greens-for-good',      'Sunrise Walk & Talk',    'A gentle 5k with the weekly group, followed by breakfast.',             now() + interval '9 days',  'Hampstead Heath'),
  ('greens-for-good',      'Volunteer Training',     'Become a peer supporter. No experience needed.',                        now() + interval '37 days', 'Community Hall, Camden'),
  ('swing-against-hunger', 'Charity Golf Day',       'Four-ball Texas scramble. All entry fees buy food.',                    now() + interval '24 days', 'Northfield Links'),
  ('birdies-for-bravery',  'Family Fun Day',         'A day out for families staying near the paediatric ward.',              now() + interval '31 days', 'St Mary''s Hospital Gardens'),
  ('blue-water-alliance',  'River Clean-Up',         'Two hours on the towpath. Gloves and bags supplied.',                   now() + interval '12 days', 'Lee Valley Towpath'),
  ('tee-off-for-trees',    'Community Planting',     'Help plant 2,000 saplings on the former colliery site.',                now() + interval '52 days', 'Brodsworth Woodland')
) as e(slug, title, description, starts_at, location)
  on c.slug = e.slug;

-- ---------------------------------------------------------------------------
-- Demo profiles, subscriptions and scores
-- ---------------------------------------------------------------------------
insert into profiles (id, email, full_name, role, charity_id, charity_percentage)
select
  v.id, v.email, v.full_name, v.role::user_role,
  (select id from charities where slug = v.charity_slug),
  v.charity_percentage
from (values
  ('user_seed_admin',  'admin@digitalheroes.test',  'Platform Admin', 'admin',      'fairways-for-futures', 10),
  ('user_seed_amelia', 'amelia@digitalheroes.test', 'Amelia Hart',    'subscriber', 'greens-for-good',      15),
  ('user_seed_raj',    'raj@digitalheroes.test',    'Raj Nair',       'subscriber', 'blue-water-alliance',  10)
) as v(id, email, full_name, role, charity_slug, charity_percentage)
on conflict (id) do update
  set email              = excluded.email,
      full_name          = excluded.full_name,
      charity_id         = excluded.charity_id,
      charity_percentage = excluded.charity_percentage;

insert into subscriptions (user_id, provider, plan, status, amount_cents, current_period_start, current_period_end)
values
  ('user_seed_amelia', 'razorpay', 'monthly', 'active', 49900, now() - interval '6 days',  now() + interval '24 days'),
  ('user_seed_raj',    'razorpay', 'yearly',  'active', 499900, now() - interval '40 days', now() + interval '325 days')
on conflict (user_id) do update
  set provider     = excluded.provider,
      plan         = excluded.plan,
      status       = excluded.status,
      amount_cents = excluded.amount_cents;

-- Five scores each — exactly the set that is played in the monthly draw.
insert into scores (user_id, value, played_on)
select v.user_id, v.value, v.played_on
from (values
  ('user_seed_amelia', 34, current_date - 33),
  ('user_seed_amelia', 28, current_date - 26),
  ('user_seed_amelia', 41, current_date - 19),
  ('user_seed_amelia', 31, current_date - 12),
  ('user_seed_amelia', 37, current_date - 5),
  ('user_seed_raj',    22, current_date - 31),
  ('user_seed_raj',    45, current_date - 24),
  ('user_seed_raj',    19, current_date - 17),
  ('user_seed_raj',    27, current_date - 10),
  ('user_seed_raj',    33, current_date - 3)
) as v(user_id, value, played_on)
on conflict (user_id, played_on) do nothing;

-- ---------------------------------------------------------------------------
-- Contribution ledger — what the Razorpay webhook would have written
-- ---------------------------------------------------------------------------
-- Amounts are in paise, matching the subscriptions above. Amelia is on 15% of
-- 49900 (7485) and Raj on 10% of 499900 (49990).
insert into charity_contributions (user_id, charity_id, subscription_id, amount_cents, period_month, provider_payment_id)
select p.id, p.charity_id, s.id,
       round(s.amount_cents * p.charity_percentage / 100)::integer,
       date_trunc('month', current_date - interval '1 month')::date,
       'seed_payment_' || p.id
from profiles p
join subscriptions s on s.user_id = p.id
where p.id in ('user_seed_amelia', 'user_seed_raj')
on conflict (provider_payment_id) do nothing;

-- ---------------------------------------------------------------------------
-- Draw history: one published draw last month, one draft for this month
-- ---------------------------------------------------------------------------
-- Amounts in paise. With Amelia on 49900/month and Raj on 499900/year, the
-- monthly-normalised revenue is 49900 + 41658.33 = 91558.33, so the pool at 50%
-- is 45779. Split 40/35/25 that is 18311 / 16022 / 11446.
insert into draws (
  draw_month, draw_type, status, winning_numbers, subscriber_count,
  total_pool_cents, rollover_in_cents, rollover_out_cents, published_at, created_by
)
values (
  date_trunc('month', current_date - interval '1 month')::date,
  'random',
  'published',
  array[19, 22, 33, 37, 41],
  2,
  45779,
  0,
  0,
  date_trunc('month', current_date)::timestamptz,
  'user_seed_admin'
)
on conflict (draw_month) do nothing;

insert into draws (draw_month, draw_type, status, created_by)
values (date_trunc('month', current_date)::date, 'random', 'draft', 'user_seed_admin')
on conflict (draw_month) do nothing;

-- Entries and the resulting winner claim for the published draw.
insert into draw_entries (draw_id, user_id, numbers, matched_count, prize_tier, prize_cents)
select
  d.id, v.user_id, v.numbers, v.matched_count, v.prize_tier::prize_tier, v.prize_cents
from draws d
join (values
  ('user_seed_amelia', array[28, 31, 34, 37, 41], 2, null,      0),
  ('user_seed_raj',    array[19, 22, 27, 33, 45], 4, '4_match', 16022)
) as v(user_id, numbers, matched_count, prize_tier, prize_cents)
  on true
where d.draw_month = date_trunc('month', current_date - interval '1 month')::date
on conflict (draw_id, user_id) do nothing;

insert into winners (draw_id, user_id, draw_entry_id, prize_tier, prize_cents)
select de.draw_id, de.user_id, de.id, de.prize_tier, de.prize_cents
from draw_entries de
join draws d on d.id = de.draw_id
where d.draw_month = date_trunc('month', current_date - interval '1 month')::date
  and de.prize_tier is not null
on conflict (draw_id, user_id) do nothing;
