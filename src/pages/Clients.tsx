import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateAppointmentModal } from '@/components/appointments/CreateAppointmentModal';
import { CreateClientModal } from '@/components/clients/CreateClientModal';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, History, Plus } from 'lucide-react';
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Database } from '@/types/database.types';
import { decryptSingleValue } from '@/lib/encryption';

type Client = Database['public']['Tables']['clients']['Row'] & {
  last_appointment_date: string | null;
  decrypted_name?: string;
  decrypted_email?: string;
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const navigate = useNavigate();

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, fetch all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('therapist_id', user.id);

      if (clientsError) throw clientsError;

      // Then, fetch the latest appointment for each client
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('client_id, session_date')
        .in('client_id', clientsData.map(client => client.id))
        .order('session_date', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      // Create a map of client_id to latest appointment date
      const latestAppointments = appointmentsData.reduce((acc, appointment) => {
        if (!acc[appointment.client_id] || 
            new Date(appointment.session_date) > new Date(acc[appointment.client_id])) {
          acc[appointment.client_id] = appointment.session_date;
        }
        return acc;
      }, {} as Record<string, string>);

      // Combine the data and decrypt client information
      const processedClients = await Promise.all(clientsData.map(async (client) => ({
        ...client,
        last_appointment_date: latestAppointments[client.id] || null,
        decrypted_name: await decryptSingleValue(client.name),
        decrypted_email: await decryptSingleValue(client.email)
      })));

      // Sort clients by last appointment date
      const sortedClients = processedClients.sort((a, b) => {
        // If both have appointments, sort by date (most recent first)
        if (a.last_appointment_date && b.last_appointment_date) {
          return new Date(b.last_appointment_date).getTime() - new Date(a.last_appointment_date).getTime();
        }
        // If only one has appointments, put the one with appointments first
        if (a.last_appointment_date) return -1;
        if (b.last_appointment_date) return 1;
        // If neither has appointments, sort by decrypted name
        return (a.decrypted_name || a.name).localeCompare(b.decrypted_name || b.name);
      });

      setClients(sortedClients);
    } catch (error) {
      toast.error("Error fetching clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreateAppointment = (client: Client) => {
    setSelectedClient(client);
    const params = new URLSearchParams(searchParams);
    params.set('modal', 'create');
    setSearchParams(params);
  };

  const handleClientCreated = () => {
    // Refresh the clients list
    fetchClients();
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-lg text-gray-500 mb-2">No clients yet</div>
        <div className="text-sm text-gray-400 mb-4">
          Add your first client to get started
        </div>
        <Button 
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.set('modal', 'add-client');
            setSearchParams(params);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Client
        </Button>
      </div>
    );
  }

  return (
    <div className="container px-4 sm:px-6 mx-auto py-6 max-w-[95%] sm:max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Button 
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.set('modal', 'add-client');
            setSearchParams(params);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Client
        </Button>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-black font-semibold text-sm"
                      style={{ backgroundColor: client.avatar_color }}
                    >
                      {client.initials}
                    </div>
                    <span className="font-medium">{client.decrypted_name || client.name}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-gray-500">
                  {client.decrypted_email || client.email}
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {clients.map((client) => (
          <div 
            key={client.id}
            className="bg-white rounded-lg border shadow-sm p-4 space-y-4"
            onClick={() => navigate(`/clients/${client.id}`)}
          >
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-black font-semibold text-sm"
                style={{ backgroundColor: client.avatar_color }}
              >
                {client.initials}
              </div>
              <div>
                <div className="font-medium">{client.decrypted_name || client.name}</div>
                <div className="text-sm text-gray-500">{client.decrypted_email || client.email}</div>
              </div>
            </div>

            <div className="flex items-center text-sm text-gray-500">
              <History className="h-4 w-4 mr-2" />
              {client.last_appointment_date 
                ? format(new Date(client.last_appointment_date), 'MMM d, yyyy')
                : 'No appointments yet'}
            </div>

            <div className="flex space-x-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateAppointment(client);
                }}
                className="flex-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50"
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                New Appointment
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/clients/${client.id}`);
                }}
                className="flex-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50"
              >
                <History className="h-4 w-4 mr-1.5" />
                View History
              </Button>
            </div>
          </div>
        ))}
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
        defaultClient={selectedClient ? {
          name: selectedClient.decrypted_name || selectedClient.name,
          email: selectedClient.decrypted_email || selectedClient.email
        } : null}
      />

      <CreateClientModal
        open={searchParams.get("modal") === "add-client"}
        onOpenChange={(open) => {
          if (!open) {
            searchParams.delete("modal");
            setSearchParams(searchParams);
          }
        }}
        onClientCreated={handleClientCreated}
      />
    </div>
  );
} 