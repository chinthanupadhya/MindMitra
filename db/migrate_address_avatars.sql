-- MindMitra app migration: address fields + avatars storage bucket
-- Run in Supabase SQL editor.

-- 1. Address / coordinates on patients
alter table patients add column address text;
alter table patients add column latitude double precision;
alter table patients add column longitude double precision;

-- 2. Mirror on caregivers (optional, harmless)
alter table caregivers add column address text;
alter table caregivers add column latitude double precision;
alter table caregivers add column longitude double precision;

-- 3. Public avatars storage bucket (uploads live here; used by Profile photo)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload/overwrite their own avatar paths.
create policy "avatar_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_update_own" on storage.objects
  for update to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);