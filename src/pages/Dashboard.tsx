import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { startOfDay, endOfDay, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppointmentsList } from "@/components/appointments/AppointmentsList";
import { CreateAppointmentModal } from "@/components/appointments/CreateAppointmentModal";
import { Calendar } from "@/components/ui/calendar";

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, [selectedDate]);

  return (
    <div className="grid grid-cols-[300px,1fr] gap-8">
      <div>
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

      <AppointmentsList
        appointments={appointments}
        selectedDate={selectedDate}
      />

      <CreateAppointmentModal
        open={searchParams.get("modal") === "create"}
        onOpenChange={(open) => {
          if (!open) {
            searchParams.delete("modal");
            setSearchParams(searchParams);
          }
        }}
      />
    </div>
  );
}
