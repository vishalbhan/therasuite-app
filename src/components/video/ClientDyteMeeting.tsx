import { RealtimeKitProvider, useRealtimeKitClient, useRealtimeKitMeeting } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DyteMeetingProps {
  appointmentId: string;
}

// RtkMeeting needs the meeting passed as a prop (the underlying web component
// binds to it). showSetupScreen renders the preview/"waiting room" and drives
// the join itself when the user clicks Join, so we must NOT join manually.
function ClientMeetingView() {
  const { meeting } = useRealtimeKitMeeting();

  if (!meeting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Failed to initialize meeting</p>
      </div>
    );
  }

  return <RtkMeeting meeting={meeting} mode="fill" className="w-full h-screen" showSetupScreen />;
}

export function ClientDyteMeetingContainer({ appointmentId }: DyteMeetingProps) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // RTKClient.init() opens a live connection bound to this appointment's
    // participant id, and RealtimeKit only allows one live session per
    // participant. If this effect runs twice, the second connection evicts the
    // first and the user's call drops. Guard against a torn-down effect and
    // always release the connection we created.
    let cancelled = false;
    let client: Awaited<ReturnType<typeof initMeeting>>;

    const setupMeeting = async () => {
      try {
        setLoading(true);
        setError(null);

        // First check if we get any results at all
        const { data: appointments, error: queryError } = await supabase
          .from('appointments')
          .select('video_meeting_id, video_client_token')
          .eq('id', appointmentId)
          .throwOnError();

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

        if (cancelled) return;

        // Initialize RealtimeKit client with the stored client token.
        // We do NOT join here — the RtkMeeting setup screen shows a preview
        // and joins on user action.
        client = await initMeeting({
          authToken: appointment.video_client_token,
          defaults: {
            audio: true,
            video: true,
          },
        });

        // Unmounted while init() was in flight — don't leak the connection.
        if (cancelled) {
          await client?.leave();
          client = undefined;
        }
      } catch (error: any) {
        console.error('Error setting up meeting:', error);
        if (!cancelled) setError(error.message || 'An unexpected error occurred');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setupMeeting();

    return () => {
      cancelled = true;
      client?.leave();
    };
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