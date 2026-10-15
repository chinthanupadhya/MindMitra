-- MindMitra: fix profile-photo upload (RLS)
-- Run in Supabase SQL editor (after migrate_address_avatars.sql).

-- Drop the stricter folder-scoped policies from the earlier migration.
drop policy if exists "avatar_upload_own" on storage.objects;
drop policy if exists "avatar_update_own" on storage.objects;

-- Permissive: any authenticated user may upload/overwrite avatars in the
-- public bucket. This is what makes the Profile photo picker work.
create policy "avatar_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

create policy "avatar_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

create policy "avatar_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

-- Ensure the public avatars bucket exists.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Patients / caregivers may update their OWN row (needed to save the photo URL).
drop policy if exists "patient_update_self" on patients;
create policy "patient_update_self" on patients
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "caregiver_update_self" on caregivers;
create policy "caregiver_update_self" on caregivers
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
