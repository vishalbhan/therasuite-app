import { RealtimeKitProvider, useRealtimeKitClient, useRealtimeKitMeeting } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { useEffect, useState, MouseEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VideoMeeting } from '@/types/dyte';
import { NotesModal } from "@/components/appointments/NotesModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PanelRightOpen, PanelRightClose, Save } from 'lucide-react';
import { decryptSingleValue } from '@/lib/encryption';

interface DyteMeetingProps {
  appointmentId: string;
}

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  therapist_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  session_date: string;
  session_length: number;
  notes?: string;
  price?: number;
}

interface Position {
  x: number;
  y: number;
}

// RtkMeeting needs the meeting passed as a prop (the underlying web component
// binds to it). showSetupScreen renders the preview/"waiting room" and drives
// the join itself when the user clicks Join, so we must NOT join manually.
function TherapistMeetingView() {
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

export function DyteMeetingContainer({ appointmentId }: DyteMeetingProps) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showNotesSidebar, setShowNotesSidebar] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [decryptedClientName, setDecryptedClientName] = useState<string>('');
  const [hasCallEnded, setHasCallEnded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 });
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callEndTime, setCallEndTime] = useState<Date | null>(null);

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      // Calculate new position
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Get window dimensions
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Set bounds (20px from edges)
      const minX = 20;
      const minY = 20;
      const maxX = windowWidth - 420; // 400px width + 20px margin
      const maxY = windowHeight - 420; // 400px height + 20px margin

      // Clamp the position within bounds
      setPosition({
        x: Math.min(Math.max(newX, minX), maxX),
        y: Math.min(Math.max(newY, minY), maxY),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    // See ClientDyteMeeting: RTKClient.init() opens a live connection tied to
    // this participant id, and a second init evicts the first. Guard the effect
    // and release the connection on teardown.
    let cancelled = false;
    let client: Awaited<ReturnType<typeof initMeeting>>;

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

        // Decrypt the client name
        if (appointmentData.client_name) {
          const decrypted = await decryptSingleValue(appointmentData.client_name);
          if (!cancelled) setDecryptedClientName(decrypted);
        }

        if (cancelled) return;

        // Initialize RealtimeKit client with the stored therapist token
        client = await initMeeting({
          authToken: appointmentData.video_therapist_token,
          defaults: {
            audio: true,
            video: true,
          },
        });

        // Unmounted while init() was in flight — don't leak the connection.
        if (cancelled) {
          await client?.leave();
          client = undefined;
          return;
        }

        // Set call start time when joining
        client?.self.on('roomJoined', () => {
          setCallStartTime(new Date());
        });

        client?.self.on('roomLeft', () => {
          setCallEndTime(new Date());
          setShowNotesModal(true);
          setHasCallEnded(true);
          setShowNotesSidebar(false);
        });

        // Note: we intentionally do NOT call client.join() here. The
        // RtkMeeting setup screen shows a preview and joins on user action.
      } catch (error: any) {
        console.error('Error setting up meeting:', error);
        if (!cancelled) setError(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setupMeeting();

    // Cleanup: tear down the client we actually created in this effect run.
    // (The previous version closed over a stale `meeting` from the first
    // render, which was always undefined, and never released the connection.)
    return () => {
      cancelled = true;
      if (client) {
        client.self.removeAllListeners('roomLeft');
        client.self.removeAllListeners('roomJoined');
        client.leave();
      }
    };
  }, [appointmentId]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove as any);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove as any);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

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
    <div className="relative h-screen">
      <RealtimeKitProvider value={meeting}>
        <TherapistMeetingView />
      </RealtimeKitProvider>

      {/* Notes Toggle Button - Only show if call hasn't ended */}
      {!hasCallEnded && (
        <Button
          variant="outline"
          className="absolute top-4 left-4 z-[9999] bg-white hover:bg-gray-100"
          onClick={() => setShowNotesSidebar(!showNotesSidebar)}
        >
          {showNotesSidebar ? 'Hide Notes' : 'Take Notes'}
        </Button>
      )}

      {/* Draggable Notes Box - Only show if call hasn't ended and notes are visible */}
      {!hasCallEnded && showNotesSidebar && (
        <div
          className="fixed bg-white rounded-lg shadow-lg z-[9999] w-[400px] h-[400px] flex flex-col"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <div
            className="p-3 bg-gray-50 rounded-t-lg cursor-grab border-b flex items-center justify-between"
            onMouseDown={handleMouseDown}
          >
            <h3 className="text-sm font-semibold">Session Notes</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="flex items-center gap-1 h-7 text-xs"
              >
                <Save className="h-3 w-3" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNotesSidebar(false)}
                className="h-7 w-7 p-0"
              >
                ×
              </Button>
            </div>
          </div>

          <div className="p-3 flex-1 flex flex-col overflow-hidden">
            {appointment && (
              <div className="mb-2 text-xs text-gray-600">
                <p>Client: {decryptedClientName || 'Loading...'}</p>
                <p>Date: {new Date(appointment.session_date).toLocaleDateString()}</p>
              </div>
            )}

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Take notes during the session..."
              className="flex-1 resize-none text-sm"
            />
          </div>
        </div>
      )}

      <NotesModal
        open={showNotesModal}
        onOpenChange={setShowNotesModal}
        appointmentId={appointmentId}
        existingNotes={notes}
        callStartTime={callStartTime}
        callEndTime={callEndTime}
        currentPrice={appointment?.price || 0}
        currentSessionLength={appointment?.session_length || 60}
        hideSessionDetails={false}
        onSuccess={() => {
          window.location.href = '/dashboard';
        }}
      />
    </div>
  );
} 