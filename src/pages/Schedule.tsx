import { useEffect, useState, useRef, DragEvent } from 'react';
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
import { useDecryptedAppointments } from '@/hooks/useDecryptedAppointments';

interface Appointment {
  id: string;
  client_name: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled';
  therapist_id: string;
  notes?: string;
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
  const decryptedAppointments = useDecryptedAppointments(appointments);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);
  const [dragTarget, setDragTarget] = useState<{ date: Date, time: string } | null>(null);
  
  // Generate week days starting from current date
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start from Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Generate time slots from 6 AM to 10 PM, but only show full hours in the time column
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

  useEffect(() => {
    const scrollToCurrentTime = () => {
      if (!scrollContainerRef.current) return;
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      const hoursSince6am = currentHour - 6;
      const halfHourIntervals = hoursSince6am * 2 + (currentMinute >= 30 ? 1 : 0);
      
      const scrollPosition = halfHourIntervals * 32;
      
      scrollContainerRef.current.scrollTop = Math.max(0, scrollPosition - 64);
    };
    
    const timer = setTimeout(scrollToCurrentTime, 100);
    return () => clearTimeout(timer);
  }, []);

  const getAppointmentsForDateAndTime = (date: Date, timeSlot: string) => {
    // Extract hour and minute from the time slot
    const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
    
    return decryptedAppointments.filter(apt => {
      // Filter out cancelled appointments
      if (apt.status === 'cancelled') return false;
      
      const aptDate = new Date(apt.session_date);
      const aptHour = aptDate.getHours();
      const aptMinute = aptDate.getMinutes();
      
      // Check if the appointment is on the same day
      if (!isSameDay(aptDate, date)) return false;
      
      // For :00 slots, show appointments that start between :00 and :29
      if (slotMinute === 0) {
        return aptHour === slotHour && aptMinute < 30;
      }
      
      // For :30 slots, show appointments that start between :30 and :59
      return aptHour === slotHour && aptMinute >= 30;
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

  // Handle drag start
  const handleDragStart = (e: DragEvent<HTMLDivElement>, appointment: Appointment) => {
    setDraggedAppointment(appointment);
    
    // Create a ghost image for dragging
    const ghost = document.createElement('div');
    ghost.classList.add('bg-blue-600', 'text-white', 'p-2', 'rounded', 'opacity-70');
    const decryptedAppointment = decryptedAppointments.find(a => a.id === appointment.id);
    ghost.textContent = decryptedAppointment?.decrypted_client_name || appointment.client_name;
    ghost.style.width = '150px';
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 75, 20);
    
    // Clean up the ghost element after drag starts
    setTimeout(() => {
      document.body.removeChild(ghost);
    }, 0);
  };

  // Handle drag over
  const handleDragOver = (e: DragEvent<HTMLDivElement>, date: Date, time: string) => {
    e.preventDefault();
    setDragTarget({ date, time });
  };

  // Handle drop
  const handleDrop = (e: DragEvent<HTMLDivElement>, date: Date, time: string) => {
    e.preventDefault();
    
    if (!draggedAppointment) return;
    
    // Open edit modal with the new date and time
    setSelectedAppointment(draggedAppointment);
    
    // Format the date and time for the edit modal
    const dropDate = new Date(date);
    const [hours, minutes] = time.split(':');
    dropDate.setHours(parseInt(hours), parseInt(minutes));
    
    // Set the form values for the edit modal
    const formValues = {
      session_date: dropDate,
      session_time: time,
      session_length: String(draggedAppointment.session_length) as "30" | "60" | "90" | "120",
      notes: draggedAppointment.notes || ""
    };
    
    // Store the values to be used when the edit modal opens
    sessionStorage.setItem('editAppointmentValues', JSON.stringify({
      session_date: dropDate.toISOString(),
      session_time: time,
      session_length: draggedAppointment.session_length,
    }));
    
    setShowEditModal(true);
    setDraggedAppointment(null);
    setDragTarget(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedAppointment(null);
    setDragTarget(null);
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
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="grid grid-cols-8">
            {/* Time column */}
            <div className="border-r">
              {timeSlots.map((time, index) => {
                const isHourMark = time.endsWith(':00');
                return (
                  <div 
                    key={time} 
                    className={clsx(
                      "border-b px-2 text-sm text-gray-500",
                      "h-8",
                      !isHourMark && "border-b-dashed" // Use dashed border for 30-min intervals
                    )}
                  >
                    {isHourMark ? time : ''} {/* Only show time for full hours */}
                  </div>
                );
              })}
            </div>

            {/* Days columns */}
            {weekDays.map((day, index) => (
              <div key={index} className="border-r">
                {timeSlots.map(time => {
                  const appointments = getAppointmentsForDateAndTime(day, time);
                  const isCurrentTimeSlot = isSameDay(day, new Date()) && 
                    time === format(new Date(), 'HH:mm');
                  
                  const isDropTarget = dragTarget && 
                    isSameDay(dragTarget.date, day) && 
                    dragTarget.time === time;
                  
                  return (
                    <div 
                      key={`${day}-${time}`} 
                      className={clsx(
                        "h-8 border-b relative group",
                        isCurrentTimeSlot && "bg-amber-50",
                        isDropTarget && "bg-blue-100"
                      )}
                      onDragOver={(e) => handleDragOver(e, day, time)}
                      onDrop={(e) => handleDrop(e, day, time)}
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set('modal', 'create');
                        params.set('date', formatDateForCreateModal(day, time));
                        setSearchParams(params);
                      }}
                    >
                      {isCurrentTimeSlot && (
                        <div className="absolute left-0 right-0 h-0.5 bg-red-500 z-20"></div>
                      )}
                      
                      {appointments.map(apt => (
                        <div
                          key={apt.id}
                          className={clsx(
                            "absolute inset-x-1 rounded text-xs text-white flex flex-col",
                            apt.session_type === 'video' ? 'bg-blue-600' : 'bg-blue-300',
                            "cursor-pointer z-10",
                            draggedAppointment?.id === apt.id && "opacity-50"
                          )}
                          style={{
                            top: '2px',
                            height: `calc(${apt.session_length / 30} * 2rem - 4px)`,
                            padding: apt.session_length >= 60 ? '4px' : '2px' // More padding for longer appointments
                          }}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, apt)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedAppointment(apt);
                          }}
                        >
                          <div className="font-medium truncate">{apt.decrypted_client_name}</div>
                          {apt.session_length >= 60 && (
                            <div className="text-[10px] opacity-90 mt-auto">
                              {apt.session_length} min {apt.session_type === 'video' ? '· Video' : '· In-Person'}
                            </div>
                          )}
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