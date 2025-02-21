-- Add payment_details to profiles table
ALTER TABLE profiles
ADD COLUMN payment_details TEXT;

-- Add payment_status to appointments table
ALTER TABLE appointments
ADD COLUMN payment_status TEXT CHECK (payment_status IN ('pending', 'invoice_sent', 'received')) DEFAULT 'pending';

-- Add payment_date to appointments table
ALTER TABLE appointments
ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE; 