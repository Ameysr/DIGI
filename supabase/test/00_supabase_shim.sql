-- ===========================================================================
-- LOCAL VALIDATION SHIM — not part of production.
--
-- The migrations target Supabase, which ships the `auth` schema, the
-- `anon`/`authenticated` roles and the `storage` schema. A plain Postgres
-- container has none of them, so this file recreates the minimum needed to
-- apply the migrations and exercise the triggers and policies locally.
--
-- `auth.jwt()` reads a session GUC so a test can impersonate a signed-in user:
--   set local test.jwt = '{"sub":"user_seed_amelia"}';
-- ===========================================================================

create schema if not exists auth;

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$
    select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb
  $$;

-- Supabase Auth owns this table and 0006 attaches a trigger to it, so the shim
-- has to provide it or the migration cannot apply.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb
);

do $$ begin
  create role anon noinherit;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated noinherit;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- storage
-- ---------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     text
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
  language sql immutable
  as $$
    select (string_to_array(name, '/'))[1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
  $$;

-- ---------------------------------------------------------------------------
-- Replicate Supabase's DEFAULT PRIVILEGES.
--
-- This matters more than it looks. Supabase sets default privileges so that
-- every new table in `public` is granted ALL to anon and authenticated. Without
-- modelling that here, the shim would start from a state where anon has no
-- table privileges at all — so an assertion like "anonymous cannot read
-- profiles" would pass for the wrong reason, and would keep passing even if the
-- migration's revoke were deleted.
--
-- This must run BEFORE the migrations create any tables, or there is nothing for
-- the default privileges to apply to.
-- ---------------------------------------------------------------------------
alter default privileges in schema public grant all on tables to anon, authenticated;

-- The migrations grant privileges to these roles; make sure the shim roles can
-- actually reach the schema they operate on. Real Supabase grants USAGE on the
-- auth schema to anon/authenticated, because RLS policies call auth.uid() and
-- auth.jwt() as the requesting user, and grants table privileges on
-- storage.objects so the storage policies are the thing doing the filtering.
grant usage on schema public, storage, auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
grant select on storage.buckets to anon, authenticated;
