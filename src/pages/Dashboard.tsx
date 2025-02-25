import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { startOfDay, endOfDay, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppointmentsList } from "@/components/appointments/AppointmentsList";
import { CreateAppointmentModal } from "@/components/appointments/CreateAppointmentModal";
import { Calendar } from "@/components/ui/calendar";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const updateAppointments = (updatedAppointments: any[]) => {
    setAppointments(updatedAppointments);
  };

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const start = startOfDay(selectedDate);
        const end = endOfDay(selectedDate);

        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('therapist_id', user.id)
          .gte('session_date', start.toISOString())
          .lte('session_date', end.toISOString())
          .order('session_date', { ascending: true });

        if (error) throw error;
        setAppointments(data);
      } catch (error: any) {
        toast.error("Error fetching appointments");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [selectedDate, refreshTrigger]);

  const handleAppointmentCreated = () => {
    setRefreshTrigger(prev => prev + 1);
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
          onSelect={(date) => date && setSelectedDate(date)}
          className="rounded-md border"
          modifiers={{ today: (date) => isToday(date) }}
          modifiersStyles={{
            today: {
              fontWeight: 'bold',
              border: '2px solid #7c3aed',
              borderRadius: '0.5rem'
            }
          }}
        />
      </div>

      <div className="order-1 md-order-2">
        <AppointmentsList
          appointments={appointments}
          selectedDate={selectedDate}
          onAppointmentsUpdate={updateAppointments}
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
