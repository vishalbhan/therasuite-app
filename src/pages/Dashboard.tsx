import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  startOfDay, endOfDay, isToday, startOfWeek, endOfWeek, isSameDay, 
  startOfMonth, endOfMonth, getMonth, getYear 
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppointmentsList } from "@/components/appointments/AppointmentsList";
import { CreateAppointmentModal } from "@/components/appointments/CreateAppointmentModal";
import { Calendar } from "@/components/ui/calendar";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWeeks, subWeeks } from "date-fns";

type Appointment = {
  id: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in-person';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string | null;
};

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWeekView, setIsWeekView] = useState(() => {
    const savedView = localStorage.getItem('dashboard_view');
    return savedView ? savedView === 'week' : true;
  });
  const [calendarAppointments, setCalendarAppointments] = useState<Appointment[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  useEffect(() => {
    localStorage.setItem('dashboard_view', isWeekView ? 'week' : 'day');
  }, [isWeekView]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const start = isWeekView ? startOfWeek(selectedDate) : startOfDay(selectedDate);
      const end = isWeekView ? endOfWeek(selectedDate) : endOfDay(selectedDate);

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('therapist_id', user.id)
        .gte('session_date', start.toISOString())
        .lte('session_date', end.toISOString())
        .order('session_date', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      toast.error("Error fetching appointments");
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarAppointments = async (month: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const start = startOfMonth(month);
      const end = endOfMonth(month);

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('therapist_id', user.id)
        .gte('session_date', start.toISOString())
        .lte('session_date', end.toISOString());

      if (error) throw error;
      setCalendarAppointments(data || []);
    } catch (error: any) {
      console.error("Error fetching calendar appointments:", error);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, isWeekView]);

  useEffect(() => {
    fetchCalendarAppointments(calendarMonth);
  }, [calendarMonth]);

  const handleAppointmentCreated = () => {
    fetchAppointments();
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsWeekView(false);
    }
  };

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
  };

  const toggleView = () => {
    setIsWeekView(!isWeekView);
  };

  const hasAppointmentsOnDate = (date: Date) => {
    return calendarAppointments.some(appointment => 
      isSameDay(new Date(appointment.session_date), date)
    );
  };

  const handleCalendarMonthChange = (month: Date) => {
    if (getMonth(month) !== getMonth(calendarMonth) || 
        getYear(month) !== getYear(calendarMonth)) {
      setCalendarMonth(month);
    }
  };

  if (loading && appointments.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="grid md:grid-cols-[300px,1fr] gap-8">
      <div className="order-2 md:order-1 max-w-[300px] mx-auto mb-20">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          onMonthChange={handleCalendarMonthChange}
          className="rounded-md border"
          modifiers={{ 
            today: (date) => isToday(date),
            hasAppointments: (date) => hasAppointmentsOnDate(date)
          }}
          modifiersStyles={{
            hasAppointments: {
              fontWeight: 'bold',
              borderRadius: '50%'
            },
            selected: {
              backgroundColor: '#7c3aed', // Primary purple color
              color: 'white !important',
              borderRadius: '50%'
            },
            today: {
              fontWeight: 'bold',
              border: '2px solid #7c3aed',
              borderRadius: '50%'
            },
          }}
        />
        
        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={toggleView}
        >
          Show {isWeekView ? "Daily" : "Weekly"} View
        </Button>
      </div>

      <div className="order-1 md-order-2">
        <AppointmentsList
          appointments={appointments}
          selectedDate={selectedDate}
          isWeekView={isWeekView}
          onUpdate={fetchAppointments}
          onDateChange={handleDateChange}
          renderNotes={(notes) => notes && (
            <div className="mt-2 flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <div className="text-sm text-gray-600 line-clamp-2 bg-blue-50 px-3 py-1.5 rounded-md">
                {notes}
              </div>
            </div>
          )}
        />
      </div>

      <CreateAppointmentModal
        open={searchParams.get("modal") === "create"}
        onOpenChange={(open) => {
          if (!open) {
            searchParams.delete("modal");
            setSearchParams(searchParams);
          }
        }}
        onAppointmentCreated={handleAppointmentCreated}
      />
    </div>
  );
}
