import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreateAppointmentModal } from '@/components/appointments/CreateAppointmentModal';
import { useSearchParams } from 'react-router-dom';
import './schedule.css';

interface Appointment {
  id: string;
  client_name: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled';
}

export default function Schedule() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('therapist_id', user.id)
          .order('session_date', { ascending: true });

        if (error) throw error;
        setAppointments(data);
      } catch (error) {
        toast.error("Error fetching appointments");
      }
    };

    fetchAppointments();
  }, []);

  // Transform appointments for FullCalendar
  const events = appointments.map(appointment => {
    const startDate = new Date(appointment.session_date);
    const endDate = new Date(startDate.getTime() + appointment.session_length * 60000);

    return {
      id: appointment.id,
      title: `${appointment.client_name} (${appointment.session_type === 'video' ? 'Video' : 'In-Person'})`,
      start: startDate,
      end: endDate,
      backgroundColor: getEventColor(appointment.status),
      borderColor: getEventColor(appointment.status),
      textColor: 'white',
      extendedProps: {
        status: appointment.status,
        type: appointment.session_type
      }
    };
  });

  return (
    <div className="h-[calc(100vh-9rem)]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        slotDuration="00:30:00"
        height="100%"
        nowIndicator={true}
        selectable={true}
        selectMirror={true}
        slotLaneClassNames="hover:bg-violet-50 transition-colors"
        select={(info) => {
          // Open create modal with pre-filled date/time
          const params = new URLSearchParams(searchParams);
          params.set('modal', 'create');
          params.set('date', info.startStr);
          setSearchParams(params);
        }}
        eventClick={(info) => {
          // Handle event click - could open edit modal
          console.log('Event clicked:', info.event);
        }}
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
          prev: '',
          next: '',
        }}
        buttonIcons={{
          prev: 'chevron-left',
          next: 'chevron-right',
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

function getEventColor(status: string): string {
  switch (status) {
    case 'completed':
      return '#16a34a'; // green-600
    case 'cancelled':
      return '#dc2626'; // red-600
    default:
      return '#7c3aed'; // violet-600
  }
} 