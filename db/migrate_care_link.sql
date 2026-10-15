-- MindMitra: Care Circle linking (patient <-> caregiver)
-- Run in Supabase SQL editor.
--
-- These SECURITY DEFINER functions let the client look up a patient or
-- caregiver by email (the email lives in auth.users, which the client
-- cannot query directly). Replace with a plain SELECT from your profiles
-- table if you keep emails there instead.

create or replace function find_patient_by_email(p_email text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name
  from patients p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

create or replace function find_caregiver_by_email(p_email text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name
  from caregivers c
  join auth.users u on u.id = c.id
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

-- RLS: a patient may read and create their own care links; a caregiver may
-- read and create links where they are the caregiver.
alter table patient_caregivers enable row level security;

drop policy if exists "pc_select_own" on patient_caregivers;
create policy "pc_select_own" on patient_caregivers
  for select to authenticated
  using (patient_id = auth.uid() or caregiver_id = auth.uid());

drop policy if exists "pc_insert_own" on patient_caregivers;
create policy "pc_insert_own" on patient_caregivers
  for insert to authenticated
  with check (patient_id = auth.uid() or caregiver_id = auth.uid());

drop policy if exists "pc_delete_own" on patient_caregivers;
create policy "pc_delete_own" on patient_caregivers
  for delete to authenticated
  using (patient_id = auth.uid() or caregiver_id = auth.uid());
