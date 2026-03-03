-- ── 1. Profiles table: stores role for every user ───────────────────────────
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null check (role in ('student', 'teacher')),
  name    text
);
alter table profiles enable row level security;
create policy "Users read own profile"   on profiles for select using (auth.uid() = user_id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = user_id);
create policy "Users update own profile" on profiles for update using (auth.uid() = user_id);

-- ── 2. Dummy module catalogue (shared reference list) ───────────────────────
create table if not exists module_catalogue (
  id    bigint generated always as identity primary key,
  code  text unique not null,
  name  text not null,
  color text not null default '#6366f1'
);
insert into module_catalogue (code, name, color) values
  ('CS101', 'Intro to Computer Science',      '#6366f1'),
  ('MA201', 'Calculus & Linear Algebra',       '#a78bfa'),
  ('PH301', 'Quantum Mechanics',               '#34d399'),
  ('CS310', 'Data Structures & Algorithms',    '#f59e0b'),
  ('AI401', 'Machine Learning Fundamentals',   '#f87171'),
  ('DB220', 'Database Systems',                '#38bdf8'),
  ('SE302', 'Software Engineering',            '#fb923c'),
  ('NW410', 'Computer Networks',               '#818cf8'),
  ('CY501', 'Cybersecurity Fundamentals',      '#4ade80'),
  ('HCI210','Human-Computer Interaction',      '#e879f9')
on conflict (code) do nothing;

-- ── 3. Teacher modules: which modules a teacher has added ───────────────────
create table if not exists teacher_modules (
  id          bigint generated always as identity primary key,
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  code        text not null,
  name        text not null,
  color       text not null default '#6366f1',
  created_at  timestamptz default now(),
  unique (teacher_id, code)
);
alter table teacher_modules enable row level security;
create policy "Teachers manage own modules"
  on teacher_modules for all using (auth.uid() = teacher_id);
-- Allow anyone to read (so students can see module info)
create policy "Anyone can read teacher_modules"
  on teacher_modules for select using (true);

-- ── 4. Teacher module students: enrolment ────────────────────────────────────
create table if not exists teacher_module_students (
  id                bigint generated always as identity primary key,
  teacher_module_id bigint not null references teacher_modules(id) on delete cascade,
  student_id        uuid not null references auth.users(id) on delete cascade,
  unique (teacher_module_id, student_id)
);
alter table teacher_module_students enable row level security;
-- Teachers manage enrolment for their own modules
create policy "Teacher manages enrolment"
  on teacher_module_students for all
  using (
    exists (
      select 1 from teacher_modules tm
      where tm.id = teacher_module_id
        and tm.teacher_id = auth.uid()
    )
  );
-- Students can see their own enrolments
create policy "Students see own enrolments"
  on teacher_module_students for select
  using (auth.uid() = student_id);

-- ── 5. Dummy student accounts in auth + profiles ─────────────────────────────
-- We can't insert into auth.users directly via SQL in the dashboard.
-- Instead, create them via the Supabase Auth API or use the seed below
-- which inserts directly into auth.users using the service role.
-- If you're running this as service role, uncomment the block below.
-- Otherwise, create these accounts manually in Auth > Users and note their UUIDs,
-- then insert into profiles manually.

-- Dummy profiles for display (insert AFTER creating the auth accounts):
-- insert into profiles (user_id, role, name) values
--   ('<uuid-alice>',   'student', 'Alice Tan'),
--   ('<uuid-bob>',     'student', 'Bob Lim'),
--   ('<uuid-charlie>', 'student', 'Charlie Wong'),
--   ('<uuid-diana>',   'student', 'Diana Ng'),
--   ('<uuid-ethan>',   'student', 'Ethan Koh'),
--   ('<uuid-fiona>',   'student', 'Fiona Lee'),
--   ('<uuid-george>',  'student', 'George Tan'),
--   ('<uuid-hannah>',  'student', 'Hannah Sim');
