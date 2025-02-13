import { useState } from "react";
import { format, addMinutes, isWithinInterval } from "date-fns";
import { Calendar as CalendarIcon, Clock, Video, MapPin, MoreVertical } from "lucide-react";
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

interface Appointment {
  id: string;
  client_name: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled';
  price: number;
  client_email: string;
}

interface AppointmentsListProps {
  appointments: Appointment[];
  selectedDate: Date;
}

export function AppointmentsList({ appointments, selectedDate }: AppointmentsListProps) {
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

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

      // Send cancellation email
      await emailService.sendAppointmentCancellation({
        client_name: appointmentToCancel.client_name,
        client_email: appointmentToCancel.client_email,
        session_date: appointmentToCancel.session_date
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

  const handleStartVideoCall = (appointmentId: string) => {
    navigate(`/video/${appointmentId}`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <CalendarIcon className="h-5 w-5" />
        Appointments for {format(selectedDate, "MMMM d, yyyy")}
      </h2>
      
      {appointments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No appointments scheduled for this day.
        </p>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="border rounded-lg p-4 hover:shadow transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{appointment.client_name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="h-4 w-4" />
                    {formatTimeRange(appointment.session_date, appointment.session_length)} · {appointment.session_length} mins
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
                    {formatCurrency(appointment.price)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs capitalize
                    ${appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : ''}
                    ${appointment.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                    ${appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {appointment.status}
                  </span>
                  {appointment.status === 'scheduled' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(appointment)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleCancelClick(appointment)}
                          className="text-red-600"
                        >
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
                <div className="flex justify-end mt-4">
                  <Button 
                    onClick={() => handleStartVideoCall(appointment.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Start Video Call
                  </Button>
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
} 