-- Enable RLS
ALTER TABLE video_meetings ENABLE ROW LEVEL SECURITY;

-- Policy for therapists to view their meetings
CREATE POLICY "Therapists can view their own meetings"
ON video_meetings
FOR SELECT
TO authenticated
USING (auth.uid() = therapist_id);

-- Policy for therapists to create meetings
CREATE POLICY "Therapists can create meetings"
ON video_meetings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = therapist_id);

-- Policy for therapists to update their meetings
CREATE POLICY "Therapists can update their own meetings"
ON video_meetings
FOR UPDATE
TO authenticated
USING (auth.uid() = therapist_id)
WITH CHECK (auth.uid() = therapist_id); 