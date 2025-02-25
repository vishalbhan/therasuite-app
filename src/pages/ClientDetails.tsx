import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateAppointmentModal } from '@/components/appointments/CreateAppointmentModal';
import { useSearchParams } from 'react-router-dom';
import { Client, Appointment } from '@/types/supabase';
import { ChevronLeft, Eye } from 'lucide-react';
import { NotesModal } from '@/components/appointments/NotesModal';
import { LoadingScreen } from "@/components/ui/loading-screen";

// Add these type definitions at the top of the file
type Database = {
  Tables: {
    clients: {
      Row: {
        id: string
        therapist_id: string
        name: string
        email: string
        avatar_color: string
        initials: string
        created_at: string
      }
    }
    appointments: {
      Row: {
        id: string
        therapist_id: string
        client_id: string
        client_name: string
        client_email: string
        session_date: string
        session_length: number
        session_type: 'video' | 'in-person'
        status: 'scheduled' | 'completed' | 'cancelled'
        notes: string | null
        created_at: string
      }
    }
  }
}

export default function ClientDetails() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewingNotes, setViewingNotes] = useState<{
    appointmentId: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    const fetchClientDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch client details
        const { data: clientData, error: clientError } = await supabase
          .from<'clients', Database['Tables']['clients']['Row']>('clients')
          .select('*')
          .eq('id', clientId)
          .eq('therapist_id', user.id)
          .single();

        if (clientError) throw clientError;
        setClient(clientData);

        // Fetch client's appointments
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from<'appointments', Database['Tables']['appointments']['Row']>('appointments')
          .select('*')
          .eq('client_id', clientId)
          .eq('therapist_id', user.id)
          .order('session_date', { ascending: false });

        if (appointmentsError) throw appointmentsError;
        setAppointments(appointmentsData || []);
      } catch (error) {
        toast.error("Error fetching client details");
      } finally {
        setLoading(false);
      }
    };

    fetchClientDetails();
  }, [clientId]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-lg text-gray-500">Client not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="flex items-center text-gray-600 hover:text-gray-900"
          onClick={() => navigate('/clients')}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Clients
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-2xl"
          style={{ backgroundColor: client.avatar_color }}
        >
          {client.initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-gray-500">{client.email}</p>
        </div>
        <div className="ml-auto">
          <Button 
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('modal', 'create');
              setSearchParams(params);
            }}
          >
            Create New Appointment
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Appointment History</h2>
        {appointments.length === 0 ? (
          <p className="text-gray-500">No appointments yet</p>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                onClick={() => setViewingNotes({
                  appointmentId: appointment.id,
                  notes: appointment.notes || ''
                })}
                className="border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-grow">
                    <div className="font-medium">
                      {format(new Date(appointment.session_date), 'PPP p')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {appointment.session_length} minutes · {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'}
                    </div>
                    {appointment.notes && (
                      <div className="mt-2 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-500" />
                        <div className="text-sm text-gray-600 line-clamp-2 bg-blue-50 px-3 py-1.5 rounded-md">
                          {appointment.notes}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs capitalize
                    ${appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : ''}
                    ${appointment.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                    ${appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {appointment.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateAppointmentModal
        open={searchParams.get("modal") === "create"}
        onOpenChange={(open) => {
          if (!open) {
            searchParams.delete("modal");
            setSearchParams(searchParams);
          }
        }}
        defaultClient={client}
        disableClientFields={true}
      />

      <NotesModal
        open={!!viewingNotes}
        onOpenChange={(open) => !open && setViewingNotes(null)}
        appointmentId={viewingNotes?.appointmentId || ''}
        existingNotes={viewingNotes?.notes || ''}
      />
    </div>
  );
} 