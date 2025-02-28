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

        // First check if we get any results at all
        const { data: appointments, error: queryError } = await supabase
          .from('appointments')
          .select('video_meeting_id, video_client_token')
          .eq('id', appointmentId);

        if (queryError) throw queryError;
        
        // Check if we got any results
        if (!appointments || appointments.length === 0) {
          throw new Error('Appointment not found');
        }

        // Check if we got multiple results (shouldn't happen, but let's handle it)
        if (appointments.length > 1) {
          throw new Error('Multiple appointments found with the same ID');
        }

        const appointment = appointments[0];

        // Check for missing video meeting details
        if (!appointment.video_meeting_id || !appointment.video_client_token) {
          throw new Error('Video meeting details not found');
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
        setError(error.message || 'An unexpected error occurred');
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