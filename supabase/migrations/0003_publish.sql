-- ===========================================================================
-- Digital Heroes — draw publication
--
-- DESIGN NOTE: the winning numbers are *passed in* rather than generated here.
-- The draw algorithm lives once, in TypeScript (src/lib/draw/engine.ts), where
-- it uses crypto.getRandomValues and is unit-tested. Reimplementing it in
-- plpgsql would mean two implementations that must agree forever, and random()
-- is not a cryptographically sound source for a payout decision. This function
-- validates the numbers it is given and commits the whole draw atomically.
--
-- CAUTION: the pool maths below mirrors computePool() and splitTiers() in
-- src/lib/draw/prizePool.ts. An admin previews a simulation computed in
-- TypeScript; if the two ever diverge, the preview will lie.
-- ===========================================================================

create or replace function publish_draw(p_draw_id uuid, p_winning_numbers integer[])
returns draws
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw              draws;
  v_rollover_in       bigint := 0;
  v_monthly_payments  numeric := 0;
  v_pool              bigint := 0;
  v_jackpot           bigint := 0;
  v_four              bigint := 0;
  v_three             bigint := 0;
  v_w5                bigint := 0;
  v_w4                bigint := 0;
  v_w3                bigint := 0;
  v_entries           integer := 0;
begin
  -- SECURITY DEFINER bypasses RLS, so authorization is asserted explicitly.
  if not is_admin() then
    raise exception 'only administrators may publish a draw' using errcode = '42501';
  end if;

  select * into v_draw from draws where id = p_draw_id for update;
  if not found then
    raise exception 'draw % does not exist', p_draw_id using errcode = 'P0002';
  end if;
  if v_draw.status = 'published' then
    raise exception 'the draw for % has already been published', v_draw.draw_month
      using errcode = '23505';
  end if;

  -- ---- Validate the engine's output -------------------------------------
  if p_winning_numbers is null or array_length(p_winning_numbers, 1) <> 5 then
    raise exception 'exactly 5 winning numbers are required' using errcode = '22023';
  end if;
  if (select count(distinct n) from unnest(p_winning_numbers) as n) <> 5 then
    raise exception 'winning numbers must be distinct' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_winning_numbers) as n where n < 1 or n > 45) then
    raise exception 'winning numbers must be between 1 and 45' using errcode = '22023';
  end if;

  -- ---- Snapshot the field ------------------------------------------------
  -- Participants are active subscribers holding a full set of five scores. A
  -- player's numbers ARE their latest five scores, which is what makes score
  -- entry load-bearing rather than decorative.
  delete from draw_entries where draw_id = p_draw_id;

  insert into draw_entries (draw_id, user_id, numbers)
  select p_draw_id, p.id, recent.numbers
  from profiles p
  join subscriptions s
    on s.user_id = p.id
   and s.status = 'active'
  cross join lateral (
    select array_agg(ordered.value order by ordered.value) as numbers
    from (
      select sc.value
      from scores sc
      where sc.user_id = p.id
      order by sc.played_on desc, sc.created_at desc
      limit 5
    ) ordered
    having count(*) = 5
  ) recent
  where recent.numbers is not null
  on conflict (draw_id, user_id) do nothing;

  select count(*) into v_entries from draw_entries where draw_id = p_draw_id;

  -- ---- Score each entry --------------------------------------------------
  -- Multiset intersection. The occurrence index is computed *per value*
  -- (partition by value), so each occurrence on one side is paired with at most
  -- one occurrence on the other. A global row_number would instead pair by
  -- sorted position, which silently under-counts any match that shifts rank.
  --
  -- Holding [30,30,12,8,4] against a draw containing one 30 scores ONE match.
  update draw_entries de
  set matched_count = coalesce((
    select count(*)::integer
    from (
      select value, row_number() over (partition by value) as occurrence
      from unnest(de.numbers) as value
    ) mine
    join (
      select value, row_number() over (partition by value) as occurrence
      from unnest(p_winning_numbers) as value
    ) drawn
      on drawn.value = mine.value
     and drawn.occurrence = mine.occurrence
  ), 0)
  where de.draw_id = p_draw_id;

  update draw_entries
  set prize_tier = case
    when matched_count >= 5 then '5_match'::prize_tier
    when matched_count = 4 then '4_match'::prize_tier
    when matched_count = 3 then '3_match'::prize_tier
    else null
  end
  where draw_id = p_draw_id;

  -- ---- Pool --------------------------------------------------------------
  -- Yearly payments are normalised to a monthly equivalent, otherwise a single
  -- yearly signup would inflate one month's pool twelvefold.
  select coalesce(sum(
    case when s.plan = 'yearly' then s.amount_cents / 12.0 else s.amount_cents end
  ), 0)
  into v_monthly_payments
  from profiles p
  join subscriptions s
    on s.user_id = p.id
   and s.status = 'active';

  -- Jackpot carried in from the most recent published draw.
  select rollover_out_cents into v_rollover_in
  from draws
  where status = 'published' and draw_month < v_draw.draw_month
  order by draw_month desc
  limit 1;
  v_rollover_in := coalesce(v_rollover_in, 0);

  v_pool    := round(v_monthly_payments * 0.50)::bigint + v_rollover_in;
  v_jackpot := floor(v_pool * 0.40)::bigint;
  v_four    := floor(v_pool * 0.35)::bigint;
  v_three   := v_pool - v_jackpot - v_four;  -- absorbs the rounding remainder

  select
    count(*) filter (where prize_tier = '5_match'),
    count(*) filter (where prize_tier = '4_match'),
    count(*) filter (where prize_tier = '3_match')
  into v_w5, v_w4, v_w3
  from draw_entries
  where draw_id = p_draw_id;

  update draw_entries
  set prize_cents = case prize_tier
    when '5_match' then case when v_w5 > 0 then v_jackpot / v_w5 else 0 end
    when '4_match' then case when v_w4 > 0 then v_four / v_w4 else 0 end
    when '3_match' then case when v_w3 > 0 then v_three / v_w3 else 0 end
    else 0
  end
  where draw_id = p_draw_id;

  insert into winners (draw_id, user_id, draw_entry_id, prize_tier, prize_cents)
  select de.draw_id, de.user_id, de.id, de.prize_tier, de.prize_cents
  from draw_entries de
  where de.draw_id = p_draw_id
    and de.prize_tier is not null
  on conflict (draw_id, user_id) do update
    set prize_tier    = excluded.prize_tier,
        prize_cents   = excluded.prize_cents,
        draw_entry_id = excluded.draw_entry_id;

  -- ---- Commit ------------------------------------------------------------
  update draws set
    winning_numbers   = p_winning_numbers,
    status            = 'published',
    published_at      = now(),
    subscriber_count  = v_entries,
    total_pool_cents  = v_pool,
    rollover_in_cents = v_rollover_in,
    rollover_out_cents = case when v_w5 = 0 then v_jackpot else 0 end
  where id = p_draw_id
  returning * into v_draw;

  insert into audit_log (actor_id, action, entity, entity_id, metadata)
  values (
    auth_user_id(),
    'draw.published',
    'draws',
    p_draw_id::text,
    jsonb_build_object(
      'draw_month',          v_draw.draw_month,
      'winning_numbers',     p_winning_numbers,
      'subscriber_count',    v_entries,
      'pool_cents',          v_pool,
      'rollover_out_cents',  v_draw.rollover_out_cents
    )
  );

  return v_draw;
end $$;

-- ---------------------------------------------------------------------------
-- Idempotently create the draft draw for a month. Called by the monthly cron
-- with the service role, and by admins from the draw management screen.
-- ---------------------------------------------------------------------------
create or replace function ensure_draw_for_month(p_month date)
returns draws
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw draws;
begin
  if auth_user_id() is not null and not is_admin() then
    raise exception 'only administrators may create draws' using errcode = '42501';
  end if;

  insert into draws (draw_month, created_by)
  values (date_trunc('month', p_month)::date, auth_user_id())
  on conflict (draw_month) do nothing;

  select * into v_draw
  from draws
  where draw_month = date_trunc('month', p_month)::date;

  return v_draw;
end $$;

revoke execute on function publish_draw(uuid, integer[]) from anon;
revoke execute on function ensure_draw_for_month(date) from anon;
