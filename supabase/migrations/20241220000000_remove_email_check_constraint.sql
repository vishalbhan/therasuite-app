-- Remove email check constraint from appointments table to allow encrypted emails
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS valid_email;

-- Also remove any email check constraint from clients table if it exists
ALTER TABLE clients DROP CONSTRAINT IF EXISTS valid_email;

-- Note: We're removing these constraints because we now store encrypted email data
-- which doesn't conform to standard email format validation