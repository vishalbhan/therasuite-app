-- Add client_id column to appointments table
ALTER TABLE appointments 
ADD COLUMN client_id UUID REFERENCES clients(id);

-- Update existing appointments to link with clients based on email
UPDATE appointments a
SET client_id = c.id
FROM clients c
WHERE a.client_email = c.email 
AND a.therapist_id = c.therapist_id;

-- Make client_id required for future appointments
ALTER TABLE appointments
ALTER COLUMN client_id SET NOT NULL; 