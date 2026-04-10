-- Add client_portal_token column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_portal_token TEXT UNIQUE;

-- Create an index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_portal_token ON projects(client_portal_token);

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS projects_select_by_token ON projects;
DROP POLICY IF EXISTS subcontractors_select_public ON subcontractors;
DROP POLICY IF EXISTS documents_select_public ON documents;
DROP POLICY IF EXISTS documents_insert_public ON documents;

-- Create a policy to allow public read access to published projects via token
CREATE POLICY projects_select_by_token ON projects
  FOR SELECT
  USING (is_published = true AND client_portal_token IS NOT NULL);

-- Allow public read access to subcontractors for published projects
CREATE POLICY subcontractors_select_public ON subcontractors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = subcontractors.project_id 
      AND projects.is_published = true 
      AND projects.client_portal_token IS NOT NULL
    )
  );

-- Allow public read access to documents for published projects
CREATE POLICY documents_select_public ON documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = documents.project_id 
      AND projects.is_published = true 
      AND projects.client_portal_token IS NOT NULL
    )
  );

-- Allow public insert access to documents for published projects (for uploads)
CREATE POLICY documents_insert_public ON documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = documents.project_id 
      AND projects.is_published = true 
      AND projects.client_portal_token IS NOT NULL
    )
  );
