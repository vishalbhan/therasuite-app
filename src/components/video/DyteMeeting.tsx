import { DyteMeeting } from '@dytesdk/react-ui-kit';
import DyteClient from '@dytesdk/web-core';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VideoMeeting } from '@/types/dyte';
import { NotesModal } from "@/components/appointments/NotesModal";

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
  const [showNotesModal, setShowNotesModal] = useState(false);

  useEffect(() => {
    const setupMeeting = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Get the meeting details from the appointments table
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .select('video_meeting_id, video_therapist_token')
          .eq('id', appointmentId)
          .single();

        if (appointmentError) throw appointmentError;
        if (!appointment.video_meeting_id || !appointment.video_therapist_token) {
          throw new Error('Video meeting not found');
        }

        // Initialize Dyte client with the stored therapist token
        const dyteClient = await DyteClient.init({
          authToken: appointment.video_therapist_token,
          defaults: {
            audio: true,
            video: true,
          },
        });

        // Add meeting state change listener
        dyteClient.self.on('roomLeft', () => {
          setShowNotesModal(true);
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

    // Cleanup function
    return () => {
      if (meeting) {
        meeting.self.removeAllListeners('roomLeft');
      }
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
    <>
      <DyteMeeting
        meeting={meeting}
        className="w-full h-screen"
        showSetupScreen
        onMeetingEnded={() => {
          setShowNotesModal(true);
        }}
        onError={(error) => {
          console.error('Dyte meeting error:', error);
          setError('Error in video call. Please try refreshing the page.');
        }}
      />

      <NotesModal
        open={showNotesModal}
        onOpenChange={setShowNotesModal}
        appointmentId={appointmentId}
        onSuccess={() => {
          // Redirect to the dashboard after saving notes
          window.location.href = '/dashboard';
        }}
      />
    </>
  );
} 