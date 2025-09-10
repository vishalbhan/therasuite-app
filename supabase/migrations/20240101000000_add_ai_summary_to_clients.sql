-- Add ai_summary field to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Add phone_number and diagnosis fields if they don't exist (from ClientDetails usage)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS diagnosis TEXT;
