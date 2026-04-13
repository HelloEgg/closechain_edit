-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- Create projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_number text not null,
  job_name text not null,
  progress integer default 0,
  total_docs integer default 0,
  received_docs integer default 0,
  is_published boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects for update using (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects for delete using (auth.uid() = user_id);

-- Create subcontractors table
create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  progress integer default 0,
  total_docs integer default 0,
  received_docs integer default 0,
  created_at timestamp with time zone default now()
);

alter table public.subcontractors enable row level security;

create policy "subcontractors_select_via_project" on public.subcontractors
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = subcontractors.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "subcontractors_insert_via_project" on public.subcontractors
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = subcontractors.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "subcontractors_update_via_project" on public.subcontractors
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = subcontractors.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "subcontractors_delete_via_project" on public.subcontractors
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = subcontractors.project_id
      and projects.user_id = auth.uid()
    )
  );
