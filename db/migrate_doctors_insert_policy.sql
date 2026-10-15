-- MindMitra: allow adding doctors from the dashboards (RLS INSERT/UPDATE)
-- Run in Supabase SQL editor.

-- Caregivers + patients add doctors from their booking forms. The earlier
-- migration only granted SELECT, which made inserts fail with "violates row
-- level security policy".

drop policy if exists "doctors_insert" on doctors;
create policy "doctors_insert" on doctors
  for insert to authenticated with check (true);

drop policy if exists "doctors_update" on doctors;
create policy "doctors_update" on doctors
  for update to authenticated using (true) with check (true);

drop policy if exists "doctor_availability_insert" on doctor_availability;
create policy "doctor_availability_insert" on doctor_availability
  for insert to authenticated with check (true);

drop policy if exists "doctor_availability_update" on doctor_availability;
create policy "doctor_availability_update" on doctor_availability
  for update to authenticated using (true) with check (true);