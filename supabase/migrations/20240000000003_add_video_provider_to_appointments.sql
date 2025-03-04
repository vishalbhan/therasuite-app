-- Add video provider and custom meeting link columns
ALTER TABLE appointments
ADD COLUMN video_provider text CHECK (video_provider IN ('therasuite', 'google_meet', 'zoom')),
ADD COLUMN custom_meeting_link text;

-- Update existing appointments to use 'therasuite' as provider
UPDATE appointments 
SET video_provider = 'therasuite' 
WHERE session_type = 'video'; 