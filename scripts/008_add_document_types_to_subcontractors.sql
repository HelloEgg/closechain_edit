-- Add document_types column to subcontractors table
-- This stores the required document types for each subcontractor as a JSON array

ALTER TABLE subcontractors 
ADD COLUMN IF NOT EXISTS document_types text[] DEFAULT ARRAY['Submittal', 'Warranty', 'As-Built']::text[];

-- Update existing subcontractors to have default document types if null
UPDATE subcontractors 
SET document_types = ARRAY['Submittal', 'Warranty', 'As-Built']::text[]
WHERE document_types IS NULL;
