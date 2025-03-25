import { DyteMeeting } from '@dytesdk/react-ui-kit';
import DyteClient from '@dytesdk/web-core';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VideoMeeting } from '@/types/dyte';
import { NotesModal } from "@/components/appointments/NotesModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PanelRightOpen, PanelRightClose, Save } from 'lucide-react';

interface DyteMeetingProps {
  appointmentId: string;
}

interface Appointment {
  id: string;
  client_email: string;
  therapist_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  session_date: string;
  session_length: number;
  notes?: string;
}

export function DyteMeetingContainer({ appointmentId }: DyteMeetingProps) {
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showNotesSidebar, setShowNotesSidebar] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [hasCallEnded, setHasCallEnded] = useState(false);

  useEffect(() => {
    const setupMeeting = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Get the meeting details from the appointments table
        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .select('*, video_meeting_id, video_therapist_token')
          .eq('id', appointmentId)
          .single();

        if (appointmentError) throw appointmentError;
        if (!appointmentData.video_meeting_id || !appointmentData.video_therapist_token) {
          throw new Error('Video meeting not found');
        }

        setAppointment(appointmentData);
        setNotes(appointmentData.notes || '');

        // Initialize Dyte client with the stored therapist token
        const dyteClient = await DyteClient.init({
          authToken: appointmentData.video_therapist_token,
          defaults: {
            audio: true,
            video: true,
          },
        });

        // Update the meeting state change listener
        dyteClient.self.on('roomLeft', () => {
          setShowNotesModal(true);
          setHasCallEnded(true);
          setShowNotesSidebar(false);
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

  const handleSaveNotes = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from("appointments")
        .update({ notes })
        .eq("id", appointmentId);

      if (error) throw error;

      // Show success message (you might want to add a toast notification here)
    } catch (error: any) {
      console.error('Error saving notes:', error);
      // Show error message
    } finally {
      setIsSaving(false);
    }
  };

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
    <div className="relative flex h-screen">
      <div className={`flex-1 transition-all duration-300 ${showNotesSidebar ? 'mr-[400px]' : ''}`}>
        <DyteMeeting
          meeting={meeting}
          className="w-full h-screen"
          showSetupScreen
          onMeetingEnded={() => {
            setShowNotesModal(true);
            setHasCallEnded(true);
            setShowNotesSidebar(false);
          }}
          onError={(error) => {
            console.error('Dyte meeting error:', error);
            setError('Error in video call. Please try refreshing the page.');
          }}
        />
      </div>

      {/* Notes Sidebar Toggle Button - Only show if call hasn't ended */}
      {!hasCallEnded && (
        <Button
          variant="outline"
          className="absolute top-4 left-4 z-[9999] bg-white hover:bg-gray-100"
          onClick={() => setShowNotesSidebar(!showNotesSidebar)}
        >
          {showNotesSidebar ? 'Hide Notes' : 'Take Notes'}
        </Button>
      )}

      {/* Notes Sidebar - Only show if call hasn't ended */}
      {!hasCallEnded && (
        <div
          className={`fixed right-0 top-0 h-full w-[400px] bg-white shadow-lg transform transition-transform duration-300 z-[9999] ${
            showNotesSidebar ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Session Notes</h3>
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
            
            {appointment && (
              <div className="mb-4 text-sm text-gray-600">
                <p>Client: {appointment.client_email}</p>
                <p>Date: {new Date(appointment.session_date).toLocaleDateString()}</p>
              </div>
            )}

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Take notes during the session..."
              className="flex-1 resize-none"
            />
          </div>
        </div>
      )}

      <NotesModal
        open={showNotesModal}
        onOpenChange={setShowNotesModal}
        appointmentId={appointmentId}
        existingNotes={notes}
        onSuccess={() => {
          // Redirect to the dashboard after saving notes
          window.location.href = '/dashboard';
        }}
      />
    </div>
  );
} 