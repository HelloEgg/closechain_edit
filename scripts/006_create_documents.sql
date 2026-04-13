-- Create documents table for tracking closeout package documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  parent_document_type text,
  package_section text,
  status text not null default 'pending',
  file_url text,
  file_name text,
  file_size integer,
  uploaded_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.documents enable row level security;

-- RLS Policies for documents
create policy "documents_select_own" on public.documents for select using (auth.uid() = user_id);
create policy "documents_insert_own" on public.documents for insert with check (auth.uid() = user_id);
create policy "documents_update_own" on public.documents for update using (auth.uid() = user_id);
create policy "documents_delete_own" on public.documents for delete using (auth.uid() = user_id);

-- Create indexes for performance
create index if not exists documents_project_id_idx on public.documents(project_id);
create index if not exists documents_subcontractor_id_idx on public.documents(subcontractor_id);
create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_status_idx on public.documents(status);

-- Update trigger for updated_at
create or replace function public.update_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_updated_at
  before update on public.documents
  for each row
  execute function public.update_documents_updated_at();
