import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateAppointmentModal } from '@/components/appointments/CreateAppointmentModal';
import { useSearchParams } from 'react-router-dom';
import { Client, Appointment } from '@/types/supabase';
import { ChevronLeft, Eye, Save, Plus, ChevronRight, Trash2 } from 'lucide-react';
import { NotesModal } from '@/components/appointments/NotesModal';
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ConfirmModal } from '@/components/ui/confirm-modal';

// Update the Database type definition to include the new fields
type Database = {
  Tables: {
    clients: {
      Row: {
        id: string
        therapist_id: string
        name: string
        email: string
        phone_number?: string // Add phone number field
        diagnosis?: string // Add diagnosis field
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

// Add this helper function at the top of the file
const categorizeAppointments = (appointments: Appointment[]) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(today);
  todayEnd.setDate(today.getDate() + 1);

  return {
    today: appointments.filter(apt => {
      const aptDate = new Date(apt.session_date);
      return aptDate >= today && aptDate < todayEnd;
    }),
    upcoming: appointments.filter(apt => {
      const aptDate = new Date(apt.session_date);
      return aptDate >= todayEnd;
    }),
    recent: appointments.filter(apt => {
      const aptDate = new Date(apt.session_date);
      return aptDate < today;
    })
  };
};

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
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  useEffect(() => {
    const fetchClientDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch client details
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .eq('therapist_id', user.id)
          .single();

        if (clientError) throw clientError;
        setClient(clientData as Client);

        // Fetch client's appointments for current month
        const startDate = startOfMonth(currentDate);
        const endDate = endOfMonth(currentDate);

        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('client_id', clientId)
          .eq('therapist_id', user.id)
          .gte('session_date', startDate.toISOString())
          .lte('session_date', endDate.toISOString())
          .order('session_date', { ascending: false });

        if (appointmentsError) throw appointmentsError;
        setAppointments(appointmentsData as Appointment[] || []);
      } catch (error) {
        toast.error("Error fetching client details");
      } finally {
        setLoading(false);
      }
    };

    fetchClientDetails();
  }, [clientId, currentDate]);

  useEffect(() => {
    if (client) {
      setClientName(client.name || '');
      setPhoneNumber(client.phone_number || '');
      setDiagnosis(client.diagnosis || '');
      setEmail(client.email || '');
    }
  }, [client]);

  const saveClientDetails = async () => {
    if (!clientName.trim()) {
      toast.error('Client name cannot be empty.');
      return;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: clientName.trim(),
          phone_number: phoneNumber,
          diagnosis: diagnosis,
          email: email
        })
        .eq('id', clientId);
        
      if (error) throw error;
      
      // Update local state
      if (client) {
        setClient({
          ...client,
          name: clientName.trim(),
          phone_number: phoneNumber,
          diagnosis: diagnosis,
          email: email
        });
      }
      
      setIsEditing(false);
      toast.success('Client details updated successfully');
    } catch (error) {
      toast.error('Failed to update client details');
      console.error(error);
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Client deleted successfully');
      setShowDeleteConfirmModal(false);
      navigate('/clients');
    } catch (error) {
      toast.error('Failed to delete client. They might have associated appointments.');
      console.error(error);
      setShowDeleteConfirmModal(false);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

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
    <div className="container px-4 sm:px-6 mx-auto py-6 max-w-[95%] sm:max-w-7xl">
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
          <h1 className="text-2xl font-bold">{isEditing ? clientName : client?.name}</h1>
          <p className="text-gray-500">{isEditing ? email : client?.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Delete Button - Desktop */}
          <Button
            variant="outline"
            className="hidden sm:flex text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setShowDeleteConfirmModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete Client
          </Button>
          {/* Delete Button - Mobile */}
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setShowDeleteConfirmModal(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Create Appointment Button - Desktop */}
          <Button
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('modal', 'create');
              setSearchParams(params);
            }}
            className="hidden sm:flex"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Appointment
          </Button>
          {/* Create Appointment Button - Mobile */}
          <Button
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('modal', 'create');
              setSearchParams(params);
            }}
            size="icon"
            className="sm:hidden"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Client Information</h2>
            <Button 
              variant={isEditing ? "outline" : "outline"} 
              onClick={() => {
                if (isEditing) {
                  saveClientDetails();
                } else {
                  setIsEditing(true);
                }
              }}
              className={`flex items-center gap-2 ${
                isEditing ? 'border-primary text-primary hover:bg-primary/10' : ''
              }`}
            >
              {isEditing ? (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              ) : (
                "Edit Details"
              )}
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={!isEditing}
                placeholder="Enter client name"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isEditing}
                placeholder="Enter email address"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={!isEditing}
                placeholder="Enter phone number"
                className="mt-1"
              />
            </div>
            
            <div className="md:col-span-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Textarea
                id="diagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                disabled={!isEditing}
                placeholder="Enter diagnosis information for this client"
                className="mt-1 min-h-[120px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4 md:gap-0">
          <h2 className="text-xl font-semibold">Appointment History</h2>
          <div className="flex items-center bg-primary/5 rounded-lg p-1 self-start md:self-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousMonth}
              className="hover:bg-primary/10 text-primary"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-medium px-4 text-primary whitespace-nowrap">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="hover:bg-primary/10 text-primary"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {appointments.length === 0 ? (
          <p className="text-gray-500">No appointments for this month</p>
        ) : (
          <div className="space-y-8">
            {/* Today's Appointments */}
            {categorizeAppointments(appointments).today.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Today</h3>
                <div className="space-y-4">
                  {categorizeAppointments(appointments).today.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onClick={() => setViewingNotes({
                        appointmentId: appointment.id,
                        notes: appointment.notes || ''
                      })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Appointments - Moved before Upcoming */}
            {categorizeAppointments(appointments).recent.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Recent</h3>
                <div className="space-y-4">
                  {categorizeAppointments(appointments).recent.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onClick={() => setViewingNotes({
                        appointmentId: appointment.id,
                        notes: appointment.notes || ''
                      })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Appointments - Moved after Recent */}
            {categorizeAppointments(appointments).upcoming.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Upcoming</h3>
                <div className="space-y-4">
                  {categorizeAppointments(appointments).upcoming.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onClick={() => setViewingNotes({
                        appointmentId: appointment.id,
                        notes: appointment.notes || ''
                      })}
                    />
                  ))}
                </div>
              </div>
            )}
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

      <ConfirmModal
        open={showDeleteConfirmModal}
        onOpenChange={setShowDeleteConfirmModal}
        title="Delete Client"
        description={`Are you sure you want to delete ${client?.name}? This action cannot be undone and may delete associated data.`}
        confirmText="Yes, delete client"
        cancelText="Cancel"
        onConfirm={handleDeleteClient}
        variant="destructive"
      />
    </div>
  );
}

// Add this component for the appointment card to avoid repetition
const AppointmentCard = ({ 
  appointment, 
  onClick 
}: { 
  appointment: Appointment; 
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
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
); 