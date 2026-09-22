-- ===========================================================================
-- Digital Heroes — Row Level Security
--
-- With a client-rendered SPA there is no server tier to repeat permission
-- checks in, so RLS is the *only* authorization layer. Every table is locked
-- down here; the browser talks to Postgres directly and these policies decide
-- what it may see.
--
-- The service role used by /api bypasses RLS entirely, which is why the tables
-- the webhook owns (subscriptions, charity_contributions, webhook_events) have
-- no write policies at all.
-- ===========================================================================

alter table profiles              enable row level security;
alter table subscriptions         enable row level security;
alter table scores                enable row level security;
alter table charities             enable row level security;
alter table charity_events        enable row level security;
alter table charity_contributions enable row level security;
alter table draws                 enable row level security;
alter table draw_entries          enable row level security;
alter table winners               enable row level security;
alter table webhook_events        enable row level security;
alter table audit_log             enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges.
--
-- IMPORTANT: Supabase sets default privileges so every new table in the public
-- schema is granted ALL to anon and authenticated. That means a `grant` alone
-- narrows nothing — without an explicit revoke, anon keeps INSERT/UPDATE/DELETE
-- on every table and RLS is the only thing filtering. Verified against a real
-- project: anon held all seven privileges on `profiles` until this revoke ran.
--
-- So anon is stripped first, then given back only the three genuinely public
-- tables. This is defence in depth, and it changes the failure mode usefully: an
-- accidental unauthenticated read of `profiles` raises "permission denied"
-- rather than quietly returning zero rows, which is far easier to diagnose than
-- an empty screen.
--
-- authenticated keeps full table privileges because RLS is what scopes it, and
-- the service role bypasses RLS entirely. RLS still applies on top of all of
-- this, so a grant is never sufficient on its own — a table with RLS enabled and
-- no matching policy returns no rows.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke all on all tables in schema public from anon;
grant select on charities, charity_events, draws to anon;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated
  using (id = auth_user_id() or is_admin());

-- Needed by the lazy "ensure profile exists" upsert that self-heals a missed
-- Clerk webhook. The role guard trigger stops someone inserting themselves.
drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = auth_user_id() or is_admin());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth_user_id() or is_admin())
  with check (id = auth_user_id() or is_admin());

drop policy if exists profiles_delete_admin on profiles;
create policy profiles_delete_admin on profiles
  for delete to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- subscriptions — read your own; nobody writes from the client.
-- ---------------------------------------------------------------------------
drop policy if exists subscriptions_select_own on subscriptions;
create policy subscriptions_select_own on subscriptions
  for select to authenticated
  using (user_id = auth_user_id() or is_admin());

-- ---------------------------------------------------------------------------
-- scores — full CRUD on your own rows; admins see and edit everything.
-- ---------------------------------------------------------------------------
drop policy if exists scores_select on scores;
create policy scores_select on scores
  for select to authenticated
  using (user_id = auth_user_id() or is_admin());

drop policy if exists scores_insert on scores;
create policy scores_insert on scores
  for insert to authenticated
  with check (user_id = auth_user_id() or is_admin());

drop policy if exists scores_update on scores;
create policy scores_update on scores
  for update to authenticated
  using (user_id = auth_user_id() or is_admin())
  with check (user_id = auth_user_id() or is_admin());

drop policy if exists scores_delete on scores;
create policy scores_delete on scores
  for delete to authenticated
  using (user_id = auth_user_id() or is_admin());

-- ---------------------------------------------------------------------------
-- charities + charity_events — public directory, admin controlled.
-- ---------------------------------------------------------------------------
drop policy if exists charities_select on charities;
create policy charities_select on charities
  for select to anon, authenticated
  using (is_active or is_admin());

drop policy if exists charities_insert_admin on charities;
create policy charities_insert_admin on charities
  for insert to authenticated
  with check (is_admin());

drop policy if exists charities_update_admin on charities;
create policy charities_update_admin on charities
  for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists charities_delete_admin on charities;
create policy charities_delete_admin on charities
  for delete to authenticated
  using (is_admin());

drop policy if exists charity_events_select on charity_events;
create policy charity_events_select on charity_events
  for select to anon, authenticated
  using (
    is_admin()
    or exists (select 1 from charities c where c.id = charity_id and c.is_active)
  );

drop policy if exists charity_events_write_admin on charity_events;
create policy charity_events_write_admin on charity_events
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- charity_contributions — read your own history; webhook writes only.
-- ---------------------------------------------------------------------------
drop policy if exists charity_contributions_select_own on charity_contributions;
create policy charity_contributions_select_own on charity_contributions
  for select to authenticated
  using (user_id = auth_user_id() or is_admin());

-- ---------------------------------------------------------------------------
-- draws — published draws are public; drafts are admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists draws_select on draws;
create policy draws_select on draws
  for select to anon, authenticated
  using (status = 'published' or is_admin());

drop policy if exists draws_insert_admin on draws;
create policy draws_insert_admin on draws
  for insert to authenticated
  with check (is_admin());

drop policy if exists draws_update_admin on draws;
create policy draws_update_admin on draws
  for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists draws_delete_admin on draws;
create policy draws_delete_admin on draws
  for delete to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- draw_entries — you see your own participation; admins see the whole draw.
-- Rows are written by publish_draw(), which is SECURITY DEFINER.
-- ---------------------------------------------------------------------------
drop policy if exists draw_entries_select on draw_entries;
create policy draw_entries_select on draw_entries
  for select to authenticated
  using (user_id = auth_user_id() or is_admin());

drop policy if exists draw_entries_write_admin on draw_entries;
create policy draw_entries_write_admin on draw_entries
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- winners — a winner may upload proof on their own claim (the guard trigger
-- blocks changes to review/payment state), admins control everything.
-- ---------------------------------------------------------------------------
drop policy if exists winners_select on winners;
create policy winners_select on winners
  for select to authenticated
  using (user_id = auth_user_id() or is_admin());

drop policy if exists winners_update_own_proof on winners;
create policy winners_update_own_proof on winners
  for update to authenticated
  using (user_id = auth_user_id() or is_admin())
  with check (user_id = auth_user_id() or is_admin());

drop policy if exists winners_write_admin on winners;
create policy winners_write_admin on winners
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- webhook_events + audit_log — admins may read; nothing is client-writable.
-- ---------------------------------------------------------------------------
drop policy if exists webhook_events_select_admin on webhook_events;
create policy webhook_events_select_admin on webhook_events
  for select to authenticated
  using (is_admin());

drop policy if exists audit_log_select_admin on audit_log;
create policy audit_log_select_admin on audit_log
  for select to authenticated
  using (is_admin());
