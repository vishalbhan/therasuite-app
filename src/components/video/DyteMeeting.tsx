import { DyteMeeting } from '@dytesdk/react-ui-kit';
import DyteClient from '@dytesdk/web-core';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VideoMeeting } from '@/types/dyte';

interface DyteMeetingProps {
  appointmentId: string;
}

interface Appointment {
  id: string;
  client_email: string;
  therapist_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  start_time: string;
  end_time: string;
}

export function DyteMeetingContainer({ appointmentId }: DyteMeetingProps) {
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    const setupMeeting = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Check if a meeting already exists for this appointment
        const { data: existingMeeting, error: fetchError } = await supabase
          .from('video_meetings')
          .select('*')
          .eq('appointment_id', appointmentId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
          throw fetchError;
        }

        let authToken: string;
        let roomName: string;

        if (existingMeeting) {
          // Use existing meeting
          authToken = existingMeeting.therapist_token;
          roomName = existingMeeting.meeting_id;
        } else {
          // Create new meeting
          const { data: appointment, error: appointmentError } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .single();

          if (appointmentError) throw appointmentError;
          const typedAppointment = appointment as Appointment;

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
                therapistId: typedAppointment.therapist_id,
                clientEmail: typedAppointment.client_email,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || 'Failed to create meeting');
          }

          const data = await response.json();
          authToken = data.authToken;
          roomName = data.roomName;
        }

        const dyteClient = await DyteClient.init({
          authToken,
          defaults: {
            audio: true,
            video: true,
          },
        });

        setMeeting(dyteClient);
      } catch (error: any) {
        console.error('Error setting up meeting:', error);
        setError(error.message);
        
        // Retry logic for certain errors
        if (retryCount < 3 && error.message.includes('network')) {
          setRetryCount(prev => prev + 1);
          setTimeout(setupMeeting, 2000 * (retryCount + 1)); // Exponential backoff
        }
      } finally {
        setLoading(false);
      }
    };

    setupMeeting();
  }, [appointmentId, retryCount]);

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
          <button
            onClick={() => setRetryCount(prev => prev + 1)}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
          >
            Retry
          </button>
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