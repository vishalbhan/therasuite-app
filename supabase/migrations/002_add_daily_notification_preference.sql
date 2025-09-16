-- Add daily_reminder_enabled column to notification_preferences table
ALTER TABLE notification_preferences
ADD COLUMN daily_reminder_enabled BOOLEAN DEFAULT true;

-- Update existing records to have daily reminders enabled by default
UPDATE notification_preferences
SET daily_reminder_enabled = true
WHERE daily_reminder_enabled IS NULL;