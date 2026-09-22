-- ===========================================================================
-- Digital Heroes — storage
--
-- Two buckets:
--   proofs        private. Winner score screenshots. Path is
--                 {clerk_user_id}/{draw_id}.{ext} so ownership is derivable
--                 from the path itself and can be enforced in a policy.
--   charity-media public. Charity artwork, shown on the public directory.
--
-- MIME type and size limits are set on the bucket rather than left to the
-- client, so an oversized or non-image upload is rejected by storage itself.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proofs',
  'proofs',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public)
values ('charity-media', 'charity-media', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- proofs
-- ---------------------------------------------------------------------------
drop policy if exists proofs_insert_own on storage.objects;
create policy proofs_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = auth_user_id()
  );

drop policy if exists proofs_select_own_or_admin on storage.objects;
create policy proofs_select_own_or_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proofs'
    and ((storage.foldername(name))[1] = auth_user_id() or is_admin())
  );

drop policy if exists proofs_update_own on storage.objects;
create policy proofs_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = auth_user_id()
  )
  with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = auth_user_id()
  );

drop policy if exists proofs_delete_own_or_admin on storage.objects;
create policy proofs_delete_own_or_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'proofs'
    and ((storage.foldername(name))[1] = auth_user_id() or is_admin())
  );

-- ---------------------------------------------------------------------------
-- charity-media
-- ---------------------------------------------------------------------------
drop policy if exists charity_media_public_read on storage.objects;
create policy charity_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'charity-media');

drop policy if exists charity_media_admin_write on storage.objects;
create policy charity_media_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'charity-media' and is_admin());

drop policy if exists charity_media_admin_modify on storage.objects;
create policy charity_media_admin_modify on storage.objects
  for update to authenticated
  using (bucket_id = 'charity-media' and is_admin())
  with check (bucket_id = 'charity-media' and is_admin());

drop policy if exists charity_media_admin_delete on storage.objects;
create policy charity_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'charity-media' and is_admin());
