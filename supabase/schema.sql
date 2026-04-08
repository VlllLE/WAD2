-- Yoga & Mindfulness Studio schema (Supabase / Postgres)
-- Paste into Supabase SQL editor and run.

-- Extensions
create extension if not exists "pgcrypto";

-- PROFILES
-- Stores display name + organiser flag for each auth user.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_organiser boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- COURSES
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date,
  end_date date,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;

-- CLASS SESSIONS (individual bookable sessions inside a course)
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  location text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_pence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_ends_after_starts check (ends_at > starts_at),
  constraint class_sessions_price_nonnegative check (price_pence >= 0)
);

alter table public.class_sessions enable row level security;

-- BOOKINGS (attendance reservations)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bookings_unique_user_session unique (user_id, session_id)
);

alter table public.bookings enable row level security;

-- UPDATED_AT helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists set_class_sessions_updated_at on public.class_sessions;
create trigger set_class_sessions_updated_at
before update on public.class_sessions
for each row execute function public.set_updated_at();

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, is_organiser)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data->>'full_name', ''), ''),
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS helpers (keeps policies readable)
create or replace function public.is_organiser()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_organiser = true
  );
$$;

-- PROFILES POLICIES
drop policy if exists "profiles: users can read own" on public.profiles;
create policy "profiles: users can read own"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "profiles: organisers can read all" on public.profiles;
create policy "profiles: organisers can read all"
on public.profiles
for select
to authenticated
using (public.is_organiser());

drop policy if exists "profiles: users can update own name" on public.profiles;
create policy "profiles: users can update own name"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "profiles: organisers can update any" on public.profiles;
create policy "profiles: organisers can update any"
on public.profiles
for update
to authenticated
using (public.is_organiser())
with check (public.is_organiser());

-- COURSES POLICIES
drop policy if exists "courses: public can read published" on public.courses;
create policy "courses: public can read published"
on public.courses
for select
to anon, authenticated
using (is_published = true or public.is_organiser());

drop policy if exists "courses: organisers can insert" on public.courses;
create policy "courses: organisers can insert"
on public.courses
for insert
to authenticated
with check (public.is_organiser());

drop policy if exists "courses: organisers can update" on public.courses;
create policy "courses: organisers can update"
on public.courses
for update
to authenticated
using (public.is_organiser())
with check (public.is_organiser());

drop policy if exists "courses: organisers can delete" on public.courses;
create policy "courses: organisers can delete"
on public.courses
for delete
to authenticated
using (public.is_organiser());

-- CLASS SESSIONS POLICIES
drop policy if exists "class_sessions: public can read for published courses" on public.class_sessions;
create policy "class_sessions: public can read for published courses"
on public.class_sessions
for select
to anon, authenticated
using (
  public.is_organiser()
  or exists (
    select 1
    from public.courses c
    where c.id = class_sessions.course_id
      and c.is_published = true
  )
);

drop policy if exists "class_sessions: organisers can insert" on public.class_sessions;
create policy "class_sessions: organisers can insert"
on public.class_sessions
for insert
to authenticated
with check (public.is_organiser());

drop policy if exists "class_sessions: organisers can update" on public.class_sessions;
create policy "class_sessions: organisers can update"
on public.class_sessions
for update
to authenticated
using (public.is_organiser())
with check (public.is_organiser());

drop policy if exists "class_sessions: organisers can delete" on public.class_sessions;
create policy "class_sessions: organisers can delete"
on public.class_sessions
for delete
to authenticated
using (public.is_organiser());

-- BOOKINGS POLICIES
drop policy if exists "bookings: users can read own" on public.bookings;
create policy "bookings: users can read own"
on public.bookings
for select
to authenticated
using (user_id = auth.uid() or public.is_organiser());

drop policy if exists "bookings: users can insert own" on public.bookings;
create policy "bookings: users can insert own"
on public.bookings
for insert
to authenticated
with check (user_id = auth.uid());

-- Optional (not used by UI right now): allow users to cancel their own booking
drop policy if exists "bookings: users can delete own" on public.bookings;
create policy "bookings: users can delete own"
on public.bookings
for delete
to authenticated
using (user_id = auth.uid() or public.is_organiser());

-- Indexes (performance)
create index if not exists courses_is_published_start_date_idx on public.courses (is_published, start_date);
create index if not exists class_sessions_course_id_starts_at_idx on public.class_sessions (course_id, starts_at);
create index if not exists bookings_user_id_created_at_idx on public.bookings (user_id, created_at desc);
create index if not exists bookings_session_id_idx on public.bookings (session_id);

