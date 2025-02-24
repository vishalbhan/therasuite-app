import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateAppointmentModal } from '@/components/appointments/CreateAppointmentModal';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, History } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
  initials: string;
  last_appointment_date: string | null;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('clients')
          .select(`
            *,
            appointments (
              session_date
            )
          `)
          .eq('therapist_id', user.id);

        if (error) throw error;

        const processedClients = data.map(client => ({
          ...client,
          last_appointment_date: client.appointments?.length > 0 
            ? client.appointments.sort((a: any, b: any) => 
                new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
              )[0].session_date
            : null
        }));

        // Sort clients by last appointment date
        const sortedClients = processedClients.sort((a, b) => {
          // If both have appointments, sort by date (most recent first)
          if (a.last_appointment_date && b.last_appointment_date) {
            return new Date(b.last_appointment_date).getTime() - new Date(a.last_appointment_date).getTime();
          }
          // If only one has appointments, put the one with appointments first
          if (a.last_appointment_date) return -1;
          if (b.last_appointment_date) return 1;
          // If neither has appointments, sort by name
          return a.name.localeCompare(b.name);
        });

        setClients(sortedClients);
      } catch (error) {
        toast.error("Error fetching clients");
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const handleCreateAppointment = (client: Client) => {
    setSelectedClient(client);
    const params = new URLSearchParams(searchParams);
    params.set('modal', 'create');
    setSearchParams(params);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-lg text-gray-500">Loading clients...</div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-lg text-gray-500 mb-2">No clients yet</div>
        <div className="text-sm text-gray-400">
          Clients will appear here when you create appointments
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Clients</h1>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="py-4 px-4 text-left font-medium text-gray-500">Client</th>
              <th className="py-4 px-4 text-left font-medium text-gray-500">Email</th>
              <th className="py-4 px-4 text-left font-medium text-gray-500">Last Appointment</th>
              <th className="py-4 px-4 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client) => (
              <tr 
                key={client.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                      style={{ backgroundColor: client.avatar_color }}
                    >
                      {client.initials}
                    </div>
                    <span className="font-medium">{client.name}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-gray-500">
                  {client.email}
                </td>
                <td className="py-4 px-4 text-gray-500">
                  {client.last_appointment_date 
                    ? format(new Date(client.last_appointment_date), 'MMM d, yyyy')
                    : 'No appointments yet'}
                </td>
                <td className="py-4 px-4 text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateAppointment(client);
                    }}
                    className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                  >
                    <Calendar className="h-4 w-4 mr-0.5" />
                    New Appointment
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/clients/${client.id}`);
                    }}
                    className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                  >
                    <History className="h-4 w-4 mr-0.5" />
                    View History
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateAppointmentModal
        open={searchParams.get("modal") === "create"}
        onOpenChange={(open) => {
          if (!open) {
            searchParams.delete("modal");
            setSearchParams(searchParams);
            setSelectedClient(null);
          }
        }}
        defaultClient={selectedClient}
      />
    </div>
  );
} 