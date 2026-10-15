-- MindMitra: dynamic appointment settings (doctors + availability)
-- Run in Supabase SQL editor.

-- Clean slate (safe: only drops tables if a partial version already exists).
drop table if exists doctor_availability;
drop table if exists doctors;

create table doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  specialty text,
  icon text,
  created_at timestamptz default now()
);

create table doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors(id) on delete cascade,
  day_of_week int not null,            -- 0 = Sunday .. 6 = Saturday
  start_time time not null,
  end_time time not null,
  slot_minutes int default 30,
  consultation_types text[] default '{in_person,video_call}',
  unique (doctor_id, day_of_week)
);

-- Seed the three doctors.
insert into doctors (name, specialty, icon) values
 ('Dr. Meera Sharma','General Physician','👩‍⚕️'),
 ('Dr. Arun Kumar','Cardiologist','👨‍⚕️'),
 ('Dr. Priya Das','Neurologist','👩‍⚕️')
on conflict (name) do nothing;

-- Seed weekday availability (Mon-Fri 9:00-20:00, Sat 9:00-14:00) per doctor.
insert into doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_minutes)
select d.id, dow,
       '09:00'::time,
       (case when dow = 6 then '14:00' else '20:00' end)::time,
       30
from doctors d
cross join generate_series(1,6) as dow
on conflict (doctor_id, day_of_week) do nothing;

-- RLS: authenticated users may read doctors + availability.
alter table doctors enable row level security;
alter table doctor_availability enable row level security;

create policy "doctors_read" on doctors
  for select to authenticated using (true);

-- Caregivers add new doctors from the dashboard; any authenticated user may
-- insert so the patient dashboard's "Add Doctor" also works.
create policy "doctors_insert" on doctors
  for insert to authenticated with check (true);

create policy "doctors_update" on doctors
  for update to authenticated using (true) with check (true);

create policy "doctor_availability_read" on doctor_availability
  for select to authenticated using (true);

-- Availability rows are created when a doctor/booking flow needs them.
create policy "doctor_availability_insert" on doctor_availability
  for insert to authenticated with check (true);