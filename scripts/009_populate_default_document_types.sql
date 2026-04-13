-- Populate existing subcontractors with default document types if null
UPDATE subcontractors
SET document_types = ARRAY['Submittal', 'Shop Drawing', 'Product Data', 'Material Certificate', 'Test Report', 'Warranty', 'O&M Manual', 'As-Built Drawing', 'Closeout Document']
WHERE document_types IS NULL OR array_length(document_types, 1) IS NULL;
