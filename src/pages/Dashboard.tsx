import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { CreateAppointmentModal } from "@/components/appointments/CreateAppointmentModal";
import { AppointmentsList } from "@/components/appointments/AppointmentsList";
import { startOfDay, endOfDay } from "date-fns";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSessionAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      // Fetch user's profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      if (error) {
        toast.error("Error fetching profile");
        return;
      }

      if (profile?.full_name) {
        // Get first name by splitting at first space
        const firstName = profile.full_name.split(' ')[0];
        setFullName(firstName);
      }
    };

    checkSessionAndProfile();
  }, [navigate]);

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

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Appointment
            </Button>
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </div>
        
        <p className="text-gray-600 mb-8">
          {getGreeting()}{fullName ? `, ${fullName}` : ''}!
        </p>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 bg-white rounded-lg p-6">
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                Loading...
              </div>
            ) : (
              <AppointmentsList 
                appointments={appointments}
                selectedDate={selectedDate}
              />
            )}
          </div>
          
          <div className="bg-white rounded-lg p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <CreateAppointmentModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
};

export default Dashboard;
