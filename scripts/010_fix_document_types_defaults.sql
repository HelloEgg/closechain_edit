-- Fix document_types for all subcontractors that have null or empty array
UPDATE subcontractors
SET document_types = ARRAY['Submittal', 'Shop Drawing', 'Product Data', 'Material Certificate', 'Test Report', 'Warranty', 'O&M Manual', 'As-Built Drawing', 'Closeout Document']
WHERE document_types IS NULL OR document_types = '{}';
