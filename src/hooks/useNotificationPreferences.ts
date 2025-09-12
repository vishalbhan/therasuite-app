import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { NotificationPreferences } from '@/types/notifications';

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.data.user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        // Create default preferences if none exist
        const defaultPreferences = {
          user_id: user.data.user.id,
          appointment_reminder_enabled: true,
          reminder_minutes_before: 15
        };

        const { data: newData, error: insertError } = await supabase
          .from('notification_preferences')
          .insert(defaultPreferences)
          .select('*')
          .single();

        if (insertError) {
          throw insertError;
        }

        setPreferences(newData);
      } else {
        setPreferences(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch notification preferences';
      setError(errorMessage);
      console.error('Failed to fetch notification preferences:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (
    updates: Partial<Pick<NotificationPreferences, 'appointment_reminder_enabled' | 'reminder_minutes_before'>>
  ): Promise<void> => {
    try {
      setError(null);

      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      const { data, error: updateError } = await supabase
        .from('notification_preferences')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.data.user.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      setPreferences(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update notification preferences';
      setError(errorMessage);
      console.error('Failed to update notification preferences:', err);
      throw err;
    }
  }, []);

  const toggleAppointmentReminders = useCallback(async (enabled: boolean): Promise<void> => {
    await updatePreferences({ appointment_reminder_enabled: enabled });
  }, [updatePreferences]);

  const updateReminderTiming = useCallback(async (minutes: number): Promise<void> => {
    await updatePreferences({ reminder_minutes_before: minutes });
  }, [updatePreferences]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
    toggleAppointmentReminders,
    updateReminderTiming,
    refetch: fetchPreferences,
    clearError: () => setError(null)
  };
}