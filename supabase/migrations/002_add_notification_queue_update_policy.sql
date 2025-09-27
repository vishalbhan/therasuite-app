-- Add UPDATE policy for notification_queue to allow users to update their own notifications
CREATE POLICY "Users can update their own notification queue" ON notification_queue
  FOR UPDATE USING (auth.uid() = user_id);
