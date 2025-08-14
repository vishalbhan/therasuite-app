-- Create clients table with therapist reference
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    initials TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(therapist_id, email)
);

-- Add RLS policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients"
    ON clients FOR SELECT
    USING (auth.uid() = therapist_id);

CREATE POLICY "Users can insert their own clients"
    ON clients FOR INSERT
    WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Users can update their own clients"
    ON clients FOR UPDATE
    USING (auth.uid() = therapist_id);

-- First create the client records for existing appointments
INSERT INTO clients (therapist_id, name, email, avatar_color, initials)
SELECT DISTINCT 
    a.therapist_id,
    a.client_name,
    a.client_email,
    '#' || encode(gen_random_bytes(3), 'hex'),
    UPPER(LEFT(a.client_name, 2))
FROM appointments a
ON CONFLICT (therapist_id, email) DO NOTHING;

-- Add client_id column to appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Update existing appointments to link with clients
UPDATE appointments a
SET client_id = c.id
FROM clients c
WHERE a.client_email = c.email 
AND a.therapist_id = c.therapist_id;

-- Now we can safely make client_id required
ALTER TABLE appointments
ALTER COLUMN client_id SET NOT NULL; 