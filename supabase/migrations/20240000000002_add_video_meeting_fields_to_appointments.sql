-- Add video meeting fields to appointments table
ALTER TABLE appointments
ADD COLUMN video_meeting_id text,
ADD COLUMN video_therapist_token text,
ADD COLUMN video_client_token text;

-- Add index for better query performance
CREATE INDEX idx_appointments_video_meeting_id ON appointments(video_meeting_id); 