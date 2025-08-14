import { useState, useEffect } from "react";
import { format, addMinutes, isWithinInterval, startOfWeek, endOfWeek, isSameDay, compareAsc, addDays, addWeeks, subWeeks, subDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Video, MapPin, MoreVertical, Eye, CalendarPlus, History, XCircle, ChevronLeft, ChevronRight, Check, Copy, CreditCard, Bell } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { EditAppointmentModal } from "./EditAppointmentModal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { emailService } from '@/lib/email';
import { NotesModal } from "./NotesModal";
import { UpdatePriceModal } from './UpdatePriceModal';

interface Appointment {
  id: string;
  client_name: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled' | 'expired';
  price: number;
  client_email: string;
  notes?: string;
  video_provider: string;
  custom_meeting_link: string;
  location?: string;
  therapist_name: string;
  therapist_photo_url?: string;
}

interface AppointmentsListProps {
  appointments: Appointment[];
  selectedDate: Date;
  isWeekView: boolean;
  loading?: boolean;
  onUpdate?: () => void;
  renderNotes?: (notes: string | undefined) => React.ReactNode;
  onDateChange?: (date: Date) => void;
}

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

function AppointmentSkeleton() {
  return (
    <div className="border rounded-lg p-4 hover:shadow transition-shadow animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-3">
          <div className="h-5 w-32 bg-gray-200 rounded"></div>
          
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-200 rounded"></div>
            <div className="h-4 w-40 bg-gray-200 rounded"></div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-200 rounded"></div>
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
          </div>
          
          <div className="h-4 w-16 bg-gray-200 rounded"></div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

const checkAndUpdateCompletedAppointments = async (appointments: Appointment[]) => {
  const now = new Date();
  const completedAppointments = appointments.filter(appointment => {
    const appointmentDate = new Date(appointment.session_date);
    const endTime = addMinutes(appointmentDate, appointment.session_length);
    return (
      appointment.status === 'scheduled' &&
      endTime < now
    );
  });

  if (completedAppointments.length === 0) return;

  // Update completed appointments in the database
  for (const appointment of completedAppointments) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointment.id);

    if (error) {
      console.error('Error updating completed appointment:', error);
    }
  }

  // Refresh the page to show updated statuses
  window.location.reload();
};

export function AppointmentsList({ 
  appointments, 
  selectedDate, 
  isWeekView,
  loading = false,
  onUpdate,
  renderNotes,
  onDateChange
}: AppointmentsListProps) {
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [viewingNotes, setViewingNotes] = useState<{
    appointmentId: string;
    notes: string;
  } | null>(null);
  const [startingCall, setStartingCall] = useState<string | null>(null);
  const [copyingLink, setCopyingLink] = useState<string | null>(null);
  const [priceUpdateAppointment, setPriceUpdateAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    checkAndUpdateCompletedAppointments(appointments);
  }, [appointments]);

  const formatTimeRange = (startTime: string, lengthInMinutes: number) => {
    const startDate = new Date(startTime);
    const endDate = addMinutes(startDate, lengthInMinutes);
    return `${format(startDate, "h:mm")} - ${format(endDate, "h:mm a")}`;
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setShowEditModal(true);
  };

  const handleCancelClick = (appointment: Appointment) => {
    setAppointmentToCancel(appointment);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!appointmentToCancel) return;
    
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentToCancel.id);

      if (error) throw error;

      // Get therapist details
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session');

      const { data: therapist, error: therapistError } = await supabase
        .from('profiles')
        .select('full_name, photo_url')
        .eq('id', user.id)
        .single();

      if (therapistError) {
        console.error('Error fetching therapist details:', therapistError);
        throw new Error('Failed to fetch therapist details');
      }

      // Send cancellation email with enhanced data
      await emailService.sendAppointmentCancellation({
        client_name: appointmentToCancel.client_name,
        client_email: appointmentToCancel.client_email,
        session_date: appointmentToCancel.session_date,
        session_length: appointmentToCancel.session_length,
        session_type: appointmentToCancel.session_type,
        location: appointmentToCancel.location,
        therapist_name: therapist.full_name || 'Your Therapist',
        therapist_photo_url: therapist.photo_url
      });

      toast({
        title: "Success",
        description: "Appointment cancelled and notification email sent",
      });

      setShowCancelModal(false);
      // Refresh the page to show updated status
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isAppointmentActive = (appointment: Appointment) => {
    const now = new Date();
    const startTime = new Date(appointment.session_date);
    const endTime = addMinutes(startTime, appointment.session_length);

    return isWithinInterval(now, { start: startTime, end: endTime });
  };

  const handleStartVideoCall = async (appointment: Appointment) => {
    try {
      setStartingCall(appointment.id);

      if (appointment.video_provider !== 'therasuite') {
        // For external providers, open the link in a new window and send email
        window.open(appointment.custom_meeting_link, '_blank');

        // Send email to client with the video link
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session');

        const emailResponse = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            type: 'video_call_link',
            data: {
              client_name: appointment.client_name,
              client_email: appointment.client_email,
              session_date: appointment.session_date,
              video_link: appointment.custom_meeting_link,
              video_provider: appointment.video_provider
            }
          })
        });

        if (!emailResponse.ok) {
          const error = await emailResponse.json();
          console.error('Email error:', error);
          toast({
            title: "Warning",
            description: "Started video call but failed to send link to client",
            variant: "warning",
          });
        } else {
          toast({
            title: "Success",
            description: "Video call link sent to client",
          });
        }
        return;
      }

      // Create Dyte meeting for TheraSuite video
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Create the Dyte meeting
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/create-dyte-meeting`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          mode: 'cors',
          body: JSON.stringify({
            appointmentId: appointment.id,
            therapistId: appointment.therapist_id,
            clientEmail: appointment.client_email,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to create meeting';
        try {
          const errorData = await response.json();
          errorMessage = errorData.details || errorMessage;
        } catch (e) {
          console.error('Error parsing response:', e);
        }
        throw new Error(errorMessage);
      }

      // Generate client video link and send email
      const clientVideoLink = `${window.location.origin}/client-video/${appointment.id}`;
      
      const emailResponse = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          type: 'video_call_link',
          data: {
            client_name: appointment.client_name,
            client_email: appointment.client_email,
            session_date: appointment.session_date,
            video_link: clientVideoLink,
            video_provider: 'therasuite'
          }
        })
      });

      if (!emailResponse.ok) {
        const error = await emailResponse.json();
        console.error('Email error:', error);
        toast({
          title: "Warning",
          description: "Started video call but failed to send link to client",
          variant: "warning",
        });
      } else {
        toast({
          title: "Success",
          description: "Video call link sent to client",
        });
      }

      // Navigate to the therapist's video call page only for TheraSuite video
      navigate(`/video/${appointment.id}`);
    } catch (error: any) {
      console.error('Error starting video call:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setStartingCall(null);
    }
  };

  const handleCopyJoinLink = async (appointment: Appointment) => {
    try {
      setCopyingLink(appointment.id);
      const joinLink = appointment.video_provider === 'therasuite' 
        ? `${window.location.origin}/client-video/${appointment.id}`
        : appointment.custom_meeting_link;
        
      await navigator.clipboard.writeText(joinLink);
      toast({
        title: "Success",
        description: "Join link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy join link",
        variant: "destructive",
      });
    } finally {
      setCopyingLink(null);
    }
  };

  const handleSendReminder = async (appointment: Appointment) => {
    try {
      const videoLink = appointment.session_type === 'video'
        ? (appointment.video_provider === 'therasuite'
            ? `${window.location.origin}/client-video/${appointment.id}`
            : appointment.custom_meeting_link)
        : undefined;

      await emailService.sendAppointmentReminder({
        client_name: appointment.client_name,
        client_email: appointment.client_email,
        session_date: appointment.session_date,
        session_type: appointment.session_type,
        video_link: videoLink,
      });

      toast({
        title: 'Reminder sent',
        description: 'Reminder email has been sent to the client.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reminder email',
        variant: 'destructive',
      });
    }
  };

  const handleStatusUpdate = async (appointment: Appointment, newStatus: AppointmentStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Appointment marked as ${newStatus}`,
      });

      // Refresh the page to show updated status
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePreviousWeek = () => {
    if (onDateChange) {
      if (isWeekView) {
        onDateChange(subWeeks(selectedDate, 1));
      } else {
        onDateChange(subDays(selectedDate, 1));
      }
    }
  };

  const handleNextWeek = () => {
    if (onDateChange) {
      if (isWeekView) {
        onDateChange(addWeeks(selectedDate, 1));
      } else {
        onDateChange(addDays(selectedDate, 1));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handlePreviousWeek}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">
              {isWeekView ? "Previous week" : "Previous day"}
            </span>
          </Button>
          
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {isWeekView ? (
              `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d, yyyy')}`
            ) : (
              format(selectedDate, 'MMMM d, yyyy')
            )}
          </h2>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleNextWeek}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">
              {isWeekView ? "Next week" : "Next day"}
            </span>
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="space-y-4">
          <AppointmentSkeleton />
          <AppointmentSkeleton />
          <AppointmentSkeleton />
        </div>
      ) : appointments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No appointments scheduled for this {isWeekView ? 'week' : 'day'}.
        </p>
      ) : (
        <div className="space-y-4">
          {isWeekView ? (
            <div className="space-y-10">
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i);
                const dayAppointments = appointments.filter(apt => 
                  isSameDay(new Date(apt.session_date), day)
                ).sort((a, b) => 
                  compareAsc(new Date(a.session_date), new Date(b.session_date))
                );
                
                return (
                  <div key={format(day, 'yyyy-MM-dd')} className="space-y-4">
                    <div className="border-b pb-2 mb-4">
                      <h3 className="text-lg font-semibold text-gray-500">
                        {format(day, 'EEEE, MMMM d', { locale: enUS })}
                      </h3>
                    </div>
                    {dayAppointments.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8 text-gray-400 italic">
                        No appointments scheduled
                      </p>
                    ) : (
                      dayAppointments.map(appointment => (
                        <div
                          key={appointment.id}
                          className="border rounded-lg p-4 hover:shadow transition-shadow"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 text-base font-medium text-blue-600 mb-1">
                                <Clock className="h-4 w-4" />
                                {formatTimeRange(appointment.session_date, appointment.session_length)}
                              </div>
                              <h3 className="font-semibold text-lg">
                                {appointment.client_name}
                              </h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span className="text-muted-foreground">{appointment.session_length} mins</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                {appointment.session_type === 'video' ? (
                                  <Video className="h-4 w-4" />
                                ) : (
                                  <MapPin className="h-4 w-4" />
                                )}
                                {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                {formatCurrency(appointment.price || 0)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`px-2 py-1 rounded-full text-xs capitalize
                                ${appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : ''}
                                ${appointment.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                                ${appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                              `}>
                                {appointment.status}
                              </div>
                              {(appointment.status === 'scheduled' || appointment.status === 'completed') && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-white">
                                    <DropdownMenuItem onClick={() => handleEdit(appointment)}>
                                      <CalendarPlus className="h-4 w-4 mr-2" />
                                      Reschedule
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => setPriceUpdateAppointment(appointment)}
                                      className="text-blue-600"
                                    >
                                      <CreditCard className="h-4 w-4 mr-2" />
                                      Update Price
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleSendReminder(appointment)}
                                      className="text-blue-600"
                                    >
                                      <Bell className="h-4 w-4 mr-2" />
                                      Send Reminder Email
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => navigate(`/clients/${appointment.client_id}`)}
                                      className="text-blue-600"
                                    >
                                      <History className="h-4 w-4 mr-2" />
                                      View Client History
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleCancelClick(appointment)}
                                      className="text-red-600"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                          {appointment.session_type === 'video' && 
                           appointment.status === 'scheduled' && 
                           isAppointmentActive(appointment) && (
                            <div className="flex justify-end gap-2 mt-4">
                              <Button 
                                variant="outline"
                                onClick={() => handleCopyJoinLink(appointment)}
                                disabled={copyingLink === appointment.id}
                              >
                                {copyingLink === appointment.id ? (
                                  <>
                                    <span className="loading loading-spinner loading-xs mr-2" />
                                    Copying...
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4 mr-1" />
                                    Copy Join Link
                                  </>
                                )}
                              </Button>
                              <Button 
                                onClick={() => handleStartVideoCall(appointment)}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={startingCall === appointment.id}
                              >
                                {startingCall === appointment.id ? (
                                  <>
                                    <span className="loading loading-spinner loading-xs mr-2" />
                                    Starting call...
                                  </>
                                ) : (
                                  <>
                                    <Video className="h-4 w-4 mr-1" />
                                    Start Video Call
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          {appointment.session_type === 'in_person' && 
                           appointment.status === 'scheduled' && 
                           isAppointmentActive(appointment) && (
                            <div className="flex justify-end gap-2 mt-4">
                              <Button 
                                onClick={() => handleStatusUpdate(appointment, 'cancelled')}
                                variant="destructive"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Mark as Cancelled
                              </Button>
                              <Button 
                                onClick={() => handleStatusUpdate(appointment, 'completed')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Mark as Completed
                              </Button>
                            </div>
                          )}
                          {appointment.notes && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between gap-4">
                                {renderNotes && (
                                  <div className="flex-1">
                                    {renderNotes(appointment.notes)}
                                  </div>
                                )}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingNotes({
                                      appointmentId: appointment.id,
                                      notes: appointment.notes
                                    });
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Edit Notes
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="border rounded-lg p-4 hover:shadow transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 text-base font-medium text-blue-600 mb-1">
                    <Clock className="h-4 w-4" />
                    {formatTimeRange(appointment.session_date, appointment.session_length)}
                  </div>
                  <h3 className="font-semibold text-lg">
                    {appointment.client_name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="text-muted-foreground">{appointment.session_length} mins</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {appointment.session_type === 'video' ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {formatCurrency(appointment.price || 0)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded-full text-xs capitalize
                    ${appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : ''}
                    ${appointment.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                    ${appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {appointment.status}
                  </div>
                  {(appointment.status === 'scheduled' || appointment.status === 'completed') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white">
                        <DropdownMenuItem onClick={() => handleEdit(appointment)}>
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setPriceUpdateAppointment(appointment)}
                          className="text-blue-600"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Update Price
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleSendReminder(appointment)}
                          className="text-blue-600"
                        >
                          <Bell className="h-4 w-4 mr-2" />
                          Send Reminder Email
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => navigate(`/clients/${appointment.client_id}`)}
                          className="text-blue-600"
                        >
                          <History className="h-4 w-4 mr-2" />
                          View Client History
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleCancelClick(appointment)}
                          className="text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {appointment.session_type === 'video' && 
               appointment.status === 'scheduled' && 
               isAppointmentActive(appointment) && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    variant="outline"
                    onClick={() => handleCopyJoinLink(appointment)}
                    disabled={copyingLink === appointment.id}
                  >
                    {copyingLink === appointment.id ? (
                      <>
                        <span className="loading loading-spinner loading-xs mr-2" />
                        Copying...
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Join Link
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={() => handleStartVideoCall(appointment)}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={startingCall === appointment.id}
                  >
                    {startingCall === appointment.id ? (
                      <>
                        <span className="loading loading-spinner loading-xs mr-2" />
                        Starting call...
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4 mr-1" />
                        Start Video Call
                      </>
                    )}
                  </Button>
                </div>
              )}
              {appointment.session_type === 'in_person' && 
               appointment.status === 'scheduled' && 
               isAppointmentActive(appointment) && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    onClick={() => handleStatusUpdate(appointment, 'cancelled')}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Mark as Cancelled
                  </Button>
                  <Button 
                    onClick={() => handleStatusUpdate(appointment, 'completed')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Mark as Completed
                  </Button>
                </div>
              )}
              {appointment.notes && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-4">
                    {renderNotes && (
                      <div className="flex-1">
                        {renderNotes(appointment.notes)}
                      </div>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingNotes({
                          appointmentId: appointment.id,
                          notes: appointment.notes
                        });
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Edit Notes
                    </Button>
                  </div>
                </div>
              )}
            </div>
            ))
          )}
        </div>
      )}

      <EditAppointmentModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        appointment={editingAppointment}
        onSuccess={() => {
          // Trigger a refresh of the appointments list
          window.location.reload();
        }}
      />

      <ConfirmModal
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        title="Cancel Appointment"
        description={`Are you sure you want to cancel the appointment with ${appointmentToCancel?.client_name}? This action cannot be undone.`}
        confirmText="Yes, cancel appointment"
        cancelText="No, keep appointment"
        onConfirm={handleCancelConfirm}
      />

      <NotesModal
        open={!!viewingNotes}
        onOpenChange={(open) => !open && setViewingNotes(null)}
        appointmentId={viewingNotes?.appointmentId || ''}
        existingNotes={viewingNotes?.notes || ''}
      />

      <UpdatePriceModal
        open={priceUpdateAppointment !== null}
        onOpenChange={(open) => {
          if (!open) setPriceUpdateAppointment(null);
        }}
        appointmentId={priceUpdateAppointment?.id || ''}
        currentPrice={priceUpdateAppointment?.price || 0}
        onUpdate={onUpdate || (() => {})}
      />
    </div>
  );
} 