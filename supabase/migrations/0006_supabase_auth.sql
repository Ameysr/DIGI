-- ===========================================================================
-- Switch identity from an external provider (Clerk) to Supabase Auth.
--
-- NOTE WHAT DOES NOT CHANGE. `auth_user_id()` reads the JWT `sub` claim:
--
--     select nullif(coalesce(auth.jwt() ->> 'sub', ''), '')
--
-- That is provider-agnostic. Supabase Auth puts the user's uuid in the same
-- claim, so every RLS policy, every trigger, and every foreign key keeps working
-- untouched. That is the payoff of not naming a provider anywhere in the schema,
-- and it is why this migration is four statements rather than a rewrite.
--
-- The only thing Supabase Auth adds is the trigger below, which creates the
-- profile row at signup instead of relying on a webhook or the client.
-- ===========================================================================

create or replace function handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id::text,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- A note on `profiles.id` being text rather than a uuid foreign key.
--
-- The canonical Supabase shape is `id uuid references auth.users(id)`. We keep
-- text deliberately: the seeded demo profiles (`user_seed_*`) exist without an
-- auth user and power the admin analytics, draw history and winner-verification
-- screens on a fresh install. A foreign key would wipe that, and every
-- `user_id` column across six tables would have to become uuid for no functional
-- gain. `auth_user_id()` returning text keeps both worlds working.
--
-- The cost is that deleting an auth user does not cascade to their profile. That
-- is handled in the application instead, and is listed in DECISIONS.md.
-- ---------------------------------------------------------------------------
