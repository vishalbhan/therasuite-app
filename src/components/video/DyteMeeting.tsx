import { DyteMeeting } from '@dytesdk/react-ui-kit';
import DyteClient from '@dytesdk/web-core';
import { useEffect, useState, MouseEvent } from 'react';
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
  price?: number;
}

interface Position {
  x: number;
  y: number;
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

        // Set call start time when joining
        dyteClient.self.on('roomJoined', () => {
          setCallStartTime(new Date());
        });

        // Update the meeting state change listener
        dyteClient.self.on('roomLeft', () => {
          setCallEndTime(new Date());
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
        meeting.self.removeAllListeners('roomJoined');
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
      <DyteMeeting
        meeting={meeting}
        className="w-full h-screen"
        showSetupScreen
        onError={(error) => {
          console.error('Dyte meeting error:', error);
          setError('Error in video call. Please try refreshing the page.');
        }}
      />

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
                <p>Client: {appointment.client_email}</p>
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
        hideSessionDetails={false}
        onSuccess={() => {
          window.location.href = '/dashboard';
        }}
      />
    </div>
  );
} 