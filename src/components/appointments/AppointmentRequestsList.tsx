import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { CreateAppointmentModal } from './CreateAppointmentModal';
import { 
  Mail, 
  MessageSquare, 
  Calendar, 
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/types/database.types';
import { 
  getAppointmentRequestsForTherapist, 
  updateAppointmentRequestStatus,
  formatPreferredDates 
} from '@/lib/appointment-requests';
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Textarea } from "@/components/ui/textarea";

type AppointmentRequest = Database['public']['Tables']['appointment_requests']['Row'];

interface AppointmentRequestsListProps {
  therapistId: string;
}

export function AppointmentRequestsList({ therapistId }: AppointmentRequestsListProps) {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<AppointmentRequest | null>(null);
  const [showCreateAppointmentModal, setShowCreateAppointmentModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [declineMessage, setDeclineMessage] = useState('');
  const [appointmentDefaultData, setAppointmentDefaultData] = useState<{
    client_name: string;
    client_email: string;
    session_date: string;
    session_time: string;
    session_length: string;
  } | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [therapistId]);

  const fetchRequests = async () => {
    try {
      const data = await getAppointmentRequestsForTherapist(therapistId);
      setRequests(data);
    } catch (error) {
      console.error('Error fetching appointment requests:', error);
      toast.error('Failed to load appointment requests');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (request: AppointmentRequest, action: 'approve' | 'decline', selectedDate?: string) => {
    setSelectedRequest(request);
    
    if (action === 'decline') {
      // For decline, directly show confirmation without response input
      setShowDeclineModal(true);
    } else {
      // For approve, prepare data for CreateAppointmentModal
      const preferredDates = formatPreferredDates(request.preferred_dates);
      const dateToUse = selectedDate || (preferredDates.length > 0 ? preferredDates[0] : new Date().toISOString());
      const appointmentDate = new Date(dateToUse);
      
      setAppointmentDefaultData({
        client_name: request.client_name,
        client_email: request.client_email,
        session_date: appointmentDate.toISOString(),
        session_time: `${appointmentDate.getHours().toString().padStart(2, '0')}:${appointmentDate.getMinutes().toString().padStart(2, '0')}`,
        session_length: (request.session_length || 60).toString(),
      });
      
      setShowCreateAppointmentModal(true);
    }
  };

  const handleAppointmentCreated = async () => {
    // When appointment is created successfully, update the request status to approved
    if (!selectedRequest) return;

    try {
      await updateAppointmentRequestStatus(
        selectedRequest.id,
        'approved',
        'Your booking request has been approved and an appointment has been created!'
      );
      toast.success('Appointment created and request approved successfully!');
      await fetchRequests();
    } catch (error) {
      console.error('Error updating request status:', error);
      toast.error('Appointment created but failed to update request status');
    }
    
    setShowCreateAppointmentModal(false);
    setSelectedRequest(null);
    setAppointmentDefaultData(null);
  };

  const handleDeclineConfirm = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessing(true);
      
      await updateAppointmentRequestStatus(
        selectedRequest.id,
        'declined',
        declineMessage || 'Your booking request has been declined.'
      );

      // Send decline email to client
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session');

        // Get therapist details
        const { data: therapist, error: therapistError } = await supabase
          .from('profiles')
          .select('full_name, photo_url, username')
          .eq('id', therapistId)
          .single();

        if (therapistError) {
          console.error('Error fetching therapist details:', therapistError);
        }

        const emailResponse = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            type: 'appointment_request_declined',
            data: {
              client_name: selectedRequest.client_name,
              client_email: selectedRequest.client_email,
              therapist_name: (therapist as any)?.full_name || 'Your Therapist',
              therapist_photo_url: (therapist as any)?.photo_url || '',
              therapist_username: (therapist as any)?.username || '',
              decline_message: declineMessage || 'Unfortunately, I am not available at the requested times.',
            }
          })
        });

        if (!emailResponse.ok) {
          const error = await emailResponse.json();
          console.error('Email error:', error);
          throw new Error('Failed to send decline notification email');
        }
      } catch (emailError) {
        console.error('Email error:', emailError);
        // Don't fail the decline process if email fails
        toast.warning('Request declined, but notification email could not be sent.');
      }

      toast.success('Request declined and client notified.');
      await fetchRequests();
      setShowDeclineModal(false);
      setSelectedRequest(null);
      setDeclineMessage('');
    } catch (error) {
      console.error('Error declining request:', error);
      toast.error('Failed to decline request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'declined':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>When clients request appointments through your public booking page, they'll appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map((request) => (
            <div key={request.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {getInitials(request.client_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{request.client_name}</h4>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Mail className="h-3 w-3 mr-1" />
                      {request.client_email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(request.status || 'pending')}
                  <span className="text-xs text-muted-foreground">
                    {formatDate(request.created_at)}
                  </span>
                </div>
              </div>



              {request.preferred_dates && request.status === 'pending' && (
                <div>
                  <p className="text-sm font-medium mb-2">Here are their preferred dates and times. Select one that works for you, or decline the request</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {formatPreferredDates(request.preferred_dates).map((date, index) => {
                      const startDate = new Date(date);
                      const endDate = new Date(startDate.getTime() + (request.session_length || 60) * 60000);
                      
                      return (
                        <Button
                          key={index}
                          size="sm"
                          onClick={() => handleResponse(request, 'approve', date)}
                          className="text-xs h-8"
                        >
                          {startDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })} | {startDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}-{endDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </Button>
                      );
                    })}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResponse(request, 'decline')}
                      className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-8"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {request.client_message && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5" />
                    <p className="text-sm">{request.client_message}</p>
                  </div>
                </div>
              )}

            </div>
          ))}
      </div>

      <CreateAppointmentModal
        open={showCreateAppointmentModal}
        onOpenChange={(open) => {
          setShowCreateAppointmentModal(open);
          if (!open) {
            setSelectedRequest(null);
            setAppointmentDefaultData(null);
          }
        }}
        defaultDate={appointmentDefaultData?.session_date || null}
        defaultClient={appointmentDefaultData ? {
          name: appointmentDefaultData.client_name,
          email: appointmentDefaultData.client_email
        } : null}
        onAppointmentCreated={handleAppointmentCreated}
        disableClientFields={true}
        defaultSessionLength={appointmentDefaultData?.session_length}
      />

      <ConfirmModal
        open={showDeclineModal}
        onOpenChange={(open) => {
          setShowDeclineModal(open);
          if (!open) {
            setDeclineMessage('');
          }
        }}
        title="Decline Request"
        description={`Are you sure you want to decline ${selectedRequest?.client_name}'s booking request?`}
        confirmText="Yes, decline request"
        cancelText="Cancel"
        onConfirm={handleDeclineConfirm}
        isLoading={processing}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can optionally include a message to explain why the request is being declined:
          </p>
          <Textarea
            placeholder="e.g., Unfortunately, I'm not available at those times. Please feel free to suggest alternative dates and times."
            value={declineMessage}
            onChange={(e) => setDeclineMessage(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      </ConfirmModal>
    </>
  );
}
