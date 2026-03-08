-- HomeSchool Management System
-- Run this file in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  role text not null check (role in ('parent','tutor','student')),
  grade_level text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'parent')
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      role = excluded.role,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

insert into public.subjects(name)
values ('Mathematics'),('English'),('Science'),('Social Studies'),('Creative Arts'),('Reading'),('Life Skills')
on conflict (name) do nothing;

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  tutor_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.classroom_members (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(classroom_id, student_id)
);

create table if not exists public.student_parent_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(parent_id, student_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  classroom_id uuid references public.classrooms(id) on delete set null,
  student_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  due_date date,
  resource_url text,
  status text default 'pending' check (status in ('pending','submitted','reviewed','completed')),
  created_at timestamptz default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_notes text,
  submission_url text,
  attachment_url text,
  status text default 'submitted' check (status in ('draft','submitted','reviewed','completed')),
  created_at timestamptz default now(),
  unique(assignment_id, student_id)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assessment_type text not null check (assessment_type in ('formative','summative')),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  score numeric(5,2) default 0,
  feedback text,
  assessment_date date,
  created_at timestamptz default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present','absent','late')),
  notes text,
  record_date date,
  created_at timestamptz default now()
);

create table if not exists public.portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  reflection text,
  artifact_url text,
  attachment_url text,
  entry_date date not null default current_date,
  created_at timestamptz default now()
);

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  term_start date,
  term_end date,
  overall_score numeric(5,2) default 0,
  summary text,
  attachment_url text,
  created_at timestamptz default now()
);

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  classroom_id uuid references public.classrooms(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  lesson_date date,
  objectives text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  classroom_id uuid references public.classrooms(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  resource_url text,
  attachment_url text,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text,
  body text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.student_parent_links enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.assessments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.portfolio_entries enable row level security;
alter table public.report_cards enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.resources enable row level security;
alter table public.messages enable row level security;

create or replace function public.current_role()
returns text language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_linked_parent(student uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.student_parent_links spl where spl.parent_id = auth.uid() and spl.student_id = student)
$$;

create or replace function public.is_student_in_tutor_scope(student uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.classroom_members cm where cm.tutor_id = auth.uid() and cm.student_id = student)
$$;

-- profiles
create policy "profiles readable by signed in users" on public.profiles
for select to authenticated using (true);
create policy "users update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- subjects
create policy "subjects read all" on public.subjects for select to authenticated using (true);

-- classrooms
create policy "classrooms read allowed" on public.classrooms for select to authenticated using (
  tutor_id = auth.uid() or exists(select 1 from public.classroom_members cm where cm.classroom_id = id and cm.student_id = auth.uid()) or exists(select 1 from public.student_parent_links spl join public.classroom_members cm on cm.student_id = spl.student_id where spl.parent_id = auth.uid() and cm.classroom_id = id)
);
create policy "tutors manage classrooms" on public.classrooms for all to authenticated using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- classroom_members
create policy "members read allowed" on public.classroom_members for select to authenticated using (
  tutor_id = auth.uid() or student_id = auth.uid() or exists(select 1 from public.student_parent_links spl where spl.parent_id = auth.uid() and spl.student_id = student_id)
);
create policy "tutor manages members" on public.classroom_members for all to authenticated using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- parent links
create policy "parent links read allowed" on public.student_parent_links for select to authenticated using (parent_id = auth.uid() or student_id = auth.uid());
create policy "parent manages links" on public.student_parent_links for all to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- assignments
create policy "assignments read allowed" on public.assignments for select to authenticated using (
  created_by = auth.uid() or student_id = auth.uid() or student_id is null or public.is_linked_parent(student_id)
);
create policy "tutor inserts assignments" on public.assignments for insert to authenticated with check (created_by = auth.uid() and public.current_role() = 'tutor');
create policy "tutor updates own assignments" on public.assignments for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- submissions
create policy "submissions read allowed" on public.submissions for select to authenticated using (
  student_id = auth.uid() or exists(select 1 from public.assignments a where a.id = assignment_id and a.created_by = auth.uid()) or public.is_linked_parent(student_id)
);
create policy "student manages own submissions" on public.submissions for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

-- assessments
create policy "assessments read allowed" on public.assessments for select to authenticated using (
  created_by = auth.uid() or student_id = auth.uid() or public.is_linked_parent(student_id)
);
create policy "tutor manages assessments" on public.assessments for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid() and public.current_role() = 'tutor');

-- attendance
create policy "attendance read allowed" on public.attendance_records for select to authenticated using (
  created_by = auth.uid() or student_id = auth.uid() or public.is_linked_parent(student_id)
);
create policy "tutor manages attendance" on public.attendance_records for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid() and public.current_role() = 'tutor');

-- portfolio
create policy "portfolio read allowed" on public.portfolio_entries for select to authenticated using (
  created_by = auth.uid() or student_id = auth.uid() or public.is_linked_parent(student_id)
);
create policy "student adds own portfolio" on public.portfolio_entries for insert to authenticated with check (student_id = auth.uid() or created_by = auth.uid());
create policy "owner updates portfolio" on public.portfolio_entries for update to authenticated using (created_by = auth.uid() or student_id = auth.uid()) with check (created_by = auth.uid() or student_id = auth.uid());

-- report cards
create policy "report cards read allowed" on public.report_cards for select to authenticated using (
  created_by = auth.uid() or student_id = auth.uid() or public.is_linked_parent(student_id)
);
create policy "tutor manages report cards" on public.report_cards for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid() and public.current_role() = 'tutor');

-- lesson plans
create policy "lesson plans read allowed" on public.lesson_plans for select to authenticated using (
  created_by = auth.uid() or exists(select 1 from public.classroom_members cm where cm.classroom_id = classroom_id and cm.student_id = auth.uid()) or exists(select 1 from public.student_parent_links spl join public.classroom_members cm on cm.student_id = spl.student_id where spl.parent_id = auth.uid() and cm.classroom_id = classroom_id)
);
create policy "tutor manages lesson plans" on public.lesson_plans for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid() and public.current_role() = 'tutor');

-- resources
create policy "resources read all signed in" on public.resources for select to authenticated using (true);
create policy "tutor manages resources" on public.resources for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid() and public.current_role() = 'tutor');

-- messages
create policy "messages read sender recipient" on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages send own" on public.messages for insert to authenticated with check (sender_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "Public can view uploads" on storage.objects
for select to public
using (bucket_id = 'uploads');

create policy "Authenticated can upload files" on storage.objects
for insert to authenticated
with check (bucket_id = 'uploads');

create policy "Authenticated can update own files" on storage.objects
for update to authenticated
using (bucket_id = 'uploads' and owner = auth.uid())
with check (bucket_id = 'uploads' and owner = auth.uid());

create policy "Authenticated can delete own files" on storage.objects
for delete to authenticated
using (bucket_id = 'uploads' and owner = auth.uid());
