import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  startOfDay, endOfDay, isToday, startOfWeek, endOfWeek, isSameDay, 
  startOfMonth, endOfMonth, getMonth, getYear, subMonths 
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppointmentsList } from "@/components/appointments/AppointmentsList";
import { CreateAppointmentModal } from "@/components/appointments/CreateAppointmentModal";
import { Calendar } from "@/components/ui/calendar";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Eye, ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWeeks, subWeeks } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

// Define a more complete Appointment type that matches your database schema
export type Appointment = {
  id: string;
  therapist_id: string;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in-person';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string | null;
  price?: number;
  created_at?: string;
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
  const [stats, setStats] = useState({
    todaysSessions: { total: 0, remaining: 0 },
    weeklyHours: { total: 0, change: 0 },
    activeClients: { total: 0, change: 0 },
    revenue: { total: 0, change: 0 }
  });

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

      // Use type assertion to tell TypeScript that the result will be Appointment[]
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('therapist_id', user.id)
        .gte('session_date', start.toISOString())
        .lte('session_date', end.toISOString())
        .order('session_date', { ascending: true });

      if (error) throw error;
      // Use type assertion to ensure TypeScript knows this is an Appointment[]
      setAppointments((data || []) as Appointment[]);
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

      // Use type assertion for the calendar appointments as well
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('therapist_id', user.id)
        .gte('session_date', start.toISOString())
        .lte('session_date', end.toISOString());

      if (error) throw error;
      // Use type assertion to ensure TypeScript knows this is an Appointment[]
      setCalendarAppointments((data || []) as Appointment[]);
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

  const calculateStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate today's sessions
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const { data: todayData } = await supabase
        .from('appointments')
        .select('*')
        .eq('therapist_id', user.id)
        .gte('session_date', todayStart.toISOString())
        .lte('session_date', todayEnd.toISOString());

      const totalToday = todayData?.length || 0;
      const remainingToday = todayData?.filter(apt => 
        new Date(apt.session_date) > new Date()
      ).length || 0;

      // Calculate this week's hours
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      const { data: weekData } = await supabase
        .from('appointments')
        .select('session_length')
        .eq('therapist_id', user.id)
        .gte('session_date', weekStart.toISOString())
        .lte('session_date', weekEnd.toISOString());

      const thisWeekHours = Math.round(
        (weekData?.reduce((acc, apt) => acc + (apt.session_length || 0), 0) || 0) / 60
      );

      // Calculate last week's hours
      const lastWeekStart = subWeeks(weekStart, 1);
      const lastWeekEnd = subWeeks(weekEnd, 1);
      const { data: lastWeekData } = await supabase
        .from('appointments')
        .select('session_length')
        .eq('therapist_id', user.id)
        .gte('session_date', lastWeekStart.toISOString())
        .lte('session_date', lastWeekEnd.toISOString());

      const lastWeekHours = Math.round(
        (lastWeekData?.reduce((acc, apt) => acc + (apt.session_length || 0), 0) || 0) / 60
      );

      const weeklyChange = thisWeekHours - lastWeekHours;

      // Calculate total unique clients (removing the 30-day restriction)
      const { data: clientData } = await supabase
        .from('appointments')
        .select('client_id')
        .eq('therapist_id', user.id)
        .not('client_id', 'is', null);

      const uniqueClients = new Set(clientData?.map(apt => apt.client_id));
      const totalClientsCount = uniqueClients.size;

      // Calculate this month's revenue
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const { data: monthData } = await supabase
        .from('appointments')
        .select('price')
        .eq('therapist_id', user.id)
        .gte('session_date', monthStart.toISOString())
        .lte('session_date', monthEnd.toISOString())
        .in('status', ['scheduled', 'completed'])
        .not('price', 'is', null);

      const thisMonthRevenue = monthData?.reduce((acc, apt) => acc + (apt.price || 0), 0) || 0;

      // Calculate last month's revenue
      const lastMonthStart = subMonths(monthStart, 1);
      const lastMonthEnd = subMonths(monthEnd, 1);
      const { data: lastMonthData } = await supabase
        .from('appointments')
        .select('price')
        .eq('therapist_id', user.id)
        .gte('session_date', lastMonthStart.toISOString())
        .lte('session_date', lastMonthEnd.toISOString())
        .in('status', ['scheduled', 'completed'])
        .not('price', 'is', null);

      const lastMonthRevenue = lastMonthData?.reduce((acc, apt) => acc + (apt.price || 0), 0) || 0;
      const revenueChange = thisMonthRevenue - lastMonthRevenue;

      setStats({
        todaysSessions: { 
          total: totalToday, 
          remaining: remainingToday 
        },
        weeklyHours: { 
          total: thisWeekHours,
          change: weeklyChange
        },
        activeClients: { 
          total: totalClientsCount,
          change: 0
        },
        revenue: {
          total: thisMonthRevenue,
          change: revenueChange
        }
      });

    } catch (error) {
      console.error("Error calculating stats:", error);
    }
  };

  useEffect(() => {
    calculateStats();
  }, []);

  if (loading && appointments.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="container px-4 sm:px-6 mx-auto py-6 max-w-[95%] sm:max-w-7xl">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.todaysSessions.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.todaysSessions.remaining} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.weeklyHours.total}</div>
            {stats.weeklyHours.change !== 0 && (
              <p className={`text-xs flex items-center gap-1 ${
                stats.weeklyHours.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.weeklyHours.change > 0 ? (
                  <>
                    <ArrowUpIcon className="h-3 w-3" />
                    +{stats.weeklyHours.change}
                  </>
                ) : (
                  <>
                    <ArrowDownIcon className="h-3 w-3" />
                    {stats.weeklyHours.change}
                  </>
                )} from last week
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.activeClients.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue this month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ₹{stats.revenue.total.toLocaleString()}
            </div>
            {stats.revenue.change !== 0 && (
              <p className={`text-xs flex items-center gap-1 ${
                stats.revenue.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.revenue.change > 0 ? (
                  <>
                    <ArrowUpIcon className="h-3 w-3" />
                    +₹{Math.abs(stats.revenue.change).toLocaleString()}
                  </>
                ) : (
                  <>
                    <ArrowDownIcon className="h-3 w-3" />
                    -₹{Math.abs(stats.revenue.change).toLocaleString()}
                  </>
                )} from last month
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
