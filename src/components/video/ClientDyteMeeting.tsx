import { RealtimeKitProvider, useRealtimeKitClient, useRealtimeKitMeeting } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DyteMeetingProps {
  appointmentId: string;
}

// RtkMeeting must read the meeting from provider context (not via a prop),
// otherwise the setup-screen Join button never completes the room join.
function ClientMeetingView() {
  const { meeting } = useRealtimeKitMeeting();

  if (!meeting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Failed to initialize meeting</p>
      </div>
    );
  }

  return <RtkMeeting mode="fill" className="w-full h-screen" showSetupScreen />;
}

export function ClientDyteMeetingContainer({ appointmentId }: DyteMeetingProps) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupMeeting = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Attempting to fetch appointment:', appointmentId);

        // First check if we get any results at all
        const { data: appointments, error: queryError } = await supabase
          .from('appointments')
          .select('video_meeting_id, video_client_token')
          .eq('id', appointmentId)
          .throwOnError();

        console.log('Query response:', { appointments, queryError }); // Debug log

        if (queryError) throw queryError;
        
        // Check if we got any results
        if (!appointments || appointments.length === 0) {
          console.log('No appointments found for ID:', appointmentId); // Debug log
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

        // Initialize RealtimeKit client with the stored client token
        await initMeeting({
          authToken: appointment.video_client_token,
          defaults: {
            audio: true,
            video: true,
          },
        });
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
    <RealtimeKitProvider value={meeting}>
      <ClientMeetingView />
    </RealtimeKitProvider>
  );
}