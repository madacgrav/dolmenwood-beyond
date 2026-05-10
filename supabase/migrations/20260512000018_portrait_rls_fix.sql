-- Fix portrait storage RLS to enforce per-user path ownership
-- Portraits must be stored at {user_id}/{character_id}/{timestamp}.ext

-- Drop the weak policies (spec names)
drop policy if exists "portraits_insert" on storage.objects;
drop policy if exists "portraits_update" on storage.objects;
drop policy if exists "portraits_select" on storage.objects;

-- Drop the weak policies created by 20260512000016_portrait_storage.sql
drop policy if exists "portraits_insert_authenticated" on storage.objects;
drop policy if exists "portraits_update_authenticated" on storage.objects;
drop policy if exists "portraits_select_public" on storage.objects;

-- Re-create with path-based ownership
create policy "portraits_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'portraits');

create policy "portraits_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portraits_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portraits_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
