-- Add missing columns to projects table
alter table public.projects
  add column if not exists name text,
  add column if not exists client_name text,
  add column if not exists end_date date,
  add column if not exists status text default 'in_progress';

-- Update projects table - make job_name optional since we now have name
alter table public.projects
  alter column job_name drop not null,
  alter column job_number drop not null;

-- Add missing columns to subcontractors table
alter table public.subcontractors
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists vendor_name text,
  add column if not exists vendor_code text,
  add column if not exists csi_code text,
  add column if not exists csi_division text,
  add column if not exists uploaded_documents integer default 0,
  add column if not exists approved_documents integer default 0;

-- Make name optional since we have vendor_name
alter table public.subcontractors
  alter column name drop not null;
