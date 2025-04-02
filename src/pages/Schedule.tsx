import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreateAppointmentModal } from '@/components/appointments/CreateAppointmentModal';
import { useSearchParams } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { AppointmentDetailsModal } from '@/components/appointments/AppointmentDetailsModal';
import { Database } from '@/types/supabase';
import { EditAppointmentModal } from '@/components/appointments/EditAppointmentModal';
import { Button } from '@/components/ui/button';
import { CalendarPlus, XCircle } from 'lucide-react';
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface Appointment {
  id: string;
  client_name: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled';
  therapist_id: string;
}

// Add this helper function to format date-time for the create modal
const formatDateForCreateModal = (date: Date, timeSlot: string) => {
  const [hours, minutes] = timeSlot.split(':');
  const newDate = new Date(date);
  newDate.setHours(parseInt(hours), parseInt(minutes));
  return newDate.toISOString();
};

export default function Schedule() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // Generate week days starting from current date
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start from Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Generate time slots from 6 AM to 10 PM
  const timeSlots = Array.from({ length: 33 }, (_, i) => {
    const hour = Math.floor(i / 2) + 6; // Start from 6 AM
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minutes}`; // Ensure 2-digit hours
  });

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('therapist_id', user.id)
          .order('session_date', { ascending: true }) as { 
            data: Appointment[] | null; 
            error: any; 
          };

        if (error) throw error;
        if (data) setAppointments(data);
      } catch (error) {
        toast.error("Error fetching appointments");
      }
    };

    fetchAppointments();
  }, []);

  const getAppointmentsForDateAndTime = (date: Date, timeSlot: string) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.session_date);
      return isSameDay(aptDate, date) && 
             format(aptDate, 'HH:mm') === timeSlot;
    });
  };

  const handlePrevWeek = () => {
    setCurrentDate(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentDate(prev => addDays(prev, 7));
  };

  const handleCancelAppointment = async () => {
    try {
      if (!selectedAppointment) return;

      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      toast.success("Appointment cancelled successfully");
      setShowCancelModal(false);
      setSelectedAppointment(null);
      window.location.reload(); // Refresh to show updated status
    } catch (error) {
      toast.error("Failed to cancel appointment");
    }
  };

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col">
      {/* Fixed header */}
      <div className="flex items-center p-4 border-b bg-background sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={handlePrevWeek} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={handleNextWeek} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'MMMM d, yyyy')}
          </h2>
        </div>
      </div>

      {/* Calendar container */}
      <div className="flex-1 flex flex-col min-h-0"> {/* Add min-h-0 to allow flex child to shrink */}
        {/* Fixed day header */}
        <div className="grid grid-cols-8 border-b bg-background sticky top-0 z-10">
          {/* Empty corner */}
          <div className="h-12 border-r"></div>
          
          {/* Days row */}
          {weekDays.map((day, index) => (
            <div key={index} className="h-12 border-r p-2 text-center">
              <div className="text-sm text-gray-500">{format(day, 'EEE')}</div>
              <div className={clsx(
                "inline-flex items-center justify-center w-8 h-8 rounded-full",
                isSameDay(day, new Date()) && "bg-blue-600 text-white"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable time slots */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="grid grid-cols-8">
            {/* Time column */}
            <div className="border-r">
              {timeSlots.map(time => (
                <div key={time} className="h-16 border-b px-2 text-sm text-gray-500">
                  {time}
                </div>
              ))}
            </div>

            {/* Days columns */}
            {weekDays.map((day, index) => (
              <div key={index} className="border-r">
                {timeSlots.map(time => {
                  const appointments = getAppointmentsForDateAndTime(day, time);
                  return (
                    <div 
                      key={`${day}-${time}`} 
                      className="h-16 border-b relative group"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set('modal', 'create');
                        params.set('date', formatDateForCreateModal(day, time));
                        setSearchParams(params);
                      }}
                    >
                      {appointments.map(apt => (
                        <div
                          key={apt.id}
                          className={clsx(
                            "absolute inset-x-1 rounded p-2 text-sm text-white",
                            apt.session_type === 'video' ? 'bg-blue-600' : 'bg-blue-300',
                            "cursor-pointer z-10"
                          )}
                          style={{
                            top: '4px',
                            height: `calc(${apt.session_length / 30} * 4rem - 8px)`
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedAppointment(apt);
                          }}
                        >
                          {apt.client_name} - {apt.session_type === 'video' ? 'Video' : 'In-Person'}
                        </div>
                      ))}
                      <div className="absolute inset-0 group-hover:bg-violet-50 transition-colors pointer-events-none"></div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AppointmentDetailsModal
        appointment={selectedAppointment}
        open={selectedAppointment !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null);
        }}
        actions={
          <div className="space-x-2">
            <Button
              onClick={() => setShowCancelModal(true)}
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Appointment
            </Button>
            <Button
              onClick={() => setShowEditModal(true)}
              variant="outline"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Reschedule
            </Button>
          </div>
        }
      />

      <ConfirmModal
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment? This action cannot be undone."
        confirmText="Yes, cancel appointment"
        cancelText="No, keep appointment"
        onConfirm={handleCancelAppointment}
      />

      <EditAppointmentModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        appointment={selectedAppointment}
        onSuccess={() => {
          setShowEditModal(false);
          setSelectedAppointment(null);
          window.location.reload(); // Refresh to show updated appointment
        }}
      />

      <CreateAppointmentModal
        open={searchParams.get("modal") === "create"}
        onOpenChange={(open) => {
          if (!open) {
            searchParams.delete("modal");
            searchParams.delete("date");
            setSearchParams(searchParams);
          }
        }}
        defaultDate={searchParams.get("date")}
      />
    </div>
  );
} 