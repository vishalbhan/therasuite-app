import { DyteMeeting } from '@dytesdk/react-ui-kit';
import DyteClient from '@dytesdk/web-core';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DyteMeetingProps {
  appointmentId: string;
}

export function ClientDyteMeetingContainer({ appointmentId }: DyteMeetingProps) {
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupMeeting = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get the meeting details from the appointments table
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .select('video_meeting_id, video_client_token')
          .eq('id', appointmentId)
          .single();

        if (appointmentError) throw appointmentError;
        if (!appointment.video_meeting_id || !appointment.video_client_token) {
          throw new Error('Video meeting not found');
        }

        // Initialize Dyte client with the stored client token
        const dyteClient = await DyteClient.init({
          authToken: appointment.video_client_token,
          defaults: {
            audio: true,
            video: true,
          },
        });

        setMeeting(dyteClient);
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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 bg-red-50 rounded-lg">
          <p className="text-red-600 mb-4">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Failed to initialize meeting</p>
      </div>
    );
  }

  return (
    <DyteMeeting
      meeting={meeting}
      className="w-full h-screen"
      showSetupScreen
      onError={(error) => {
        console.error('Dyte meeting error:', error);
        setError('Error in video call. Please try refreshing the page.');
      }}
    />
  );
}