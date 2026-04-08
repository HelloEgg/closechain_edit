-- Add document tracking columns to projects table
alter table public.projects 
  add column if not exists total_documents integer default 0,
  add column if not exists uploaded_documents integer default 0,
  add column if not exists approved_documents integer default 0;

-- Update existing projects to calculate totals from subcontractors
update public.projects p
set 
  total_documents = coalesce((
    select sum(total_docs) from public.subcontractors where project_id = p.id
  ), 0),
  uploaded_documents = coalesce((
    select sum(received_docs) from public.subcontractors where project_id = p.id
  ), 0),
  approved_documents = 0;
