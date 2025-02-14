-- Add client_email column to video_meetings table
ALTER TABLE video_meetings 
ADD COLUMN client_email TEXT NOT NULL;

-- Add any missing columns if they don't exist
DO $$ 
BEGIN
    -- Check and add therapist_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'video_meetings' 
                  AND column_name = 'therapist_id') THEN
        ALTER TABLE video_meetings 
        ADD COLUMN therapist_id UUID NOT NULL REFERENCES auth.users(id);
    END IF;

    -- Check and add appointment_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'video_meetings' 
                  AND column_name = 'appointment_id') THEN
        ALTER TABLE video_meetings 
        ADD COLUMN appointment_id UUID NOT NULL REFERENCES appointments(id);
    END IF;

    -- Check and add meeting_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'video_meetings' 
                  AND column_name = 'meeting_id') THEN
        ALTER TABLE video_meetings 
        ADD COLUMN meeting_id TEXT NOT NULL;
    END IF;

    -- Check and add therapist_token if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'video_meetings' 
                  AND column_name = 'therapist_token') THEN
        ALTER TABLE video_meetings 
        ADD COLUMN therapist_token TEXT NOT NULL;
    END IF;

    -- Check and add client_token if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'video_meetings' 
                  AND column_name = 'client_token') THEN
        ALTER TABLE video_meetings 
        ADD COLUMN client_token TEXT NOT NULL;
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_video_meetings_appointment_id ON video_meetings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_therapist_id ON video_meetings(therapist_id); 