import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateAppointmentModal } from '@/components/appointments/CreateAppointmentModal';
import { useSearchParams } from 'react-router-dom';

interface Client {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
  initials: string;
  updated_at: string;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('therapist_id', user.id)
          .order('name');

        if (error) throw error;
        setClients(data);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <div
            key={client.id}
            className="bg-white rounded-lg shadow-sm p-4 flex items-center space-x-4 hover:shadow-md transition-shadow"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
              style={{ backgroundColor: client.avatar_color }}
            >
              {client.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{client.name}</div>
              <div className="text-sm text-gray-500 truncate">{client.email}</div>
            </div>
            <div className="text-xs text-gray-400">
              Last updated: {new Date(client.updated_at).toLocaleDateString()}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleCreateAppointment(client)}>
                  Create appointment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        defaultClient={selectedClient}
      />
    </div>
  );
} 