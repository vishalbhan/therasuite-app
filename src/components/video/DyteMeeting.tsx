import { DyteMeeting } from '@dytesdk/react-ui-kit';
import DyteClient from '@dytesdk/web-core';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DyteMeetingProps {
  appointmentId: string;
}

export function DyteMeetingContainer({ appointmentId }: DyteMeetingProps) {
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const setupMeeting = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        const { data: appointment, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', appointmentId)
          .single();

        if (error) throw error;

        // Call the Edge Function instead of the API route
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/create-dyte-meeting`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              appointmentId,
              therapistId: user.id,
              clientEmail: appointment.client_email,
            }),
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }

        const { authToken, roomName } = data;

        const dyteClient = await DyteClient.init({
          authToken,
          roomName,
          defaults: {
            audio: true,
            video: true,
          },
        });

        setMeeting(dyteClient);
        setError(null);
      } catch (error: any) {
        console.error('Error setting up meeting:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    setupMeeting();
  }, [appointmentId]);

  if (loading) {
    return <div>Loading meeting...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!meeting) {
    return <div>Failed to initialize meeting</div>;
  }

  return (
    <DyteMeeting
      meeting={meeting}
      className="w-full h-screen"
      showSetupScreen
    />
  );
} 