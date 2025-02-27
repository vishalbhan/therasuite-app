import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, Video, MapPin, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  price: number;
  payment_status: 'pending' | 'invoice_sent' | 'received';
  payment_date?: string;
}

export default function Invoices() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadingInvoices, setLoadingInvoices] = useState<Record<string, boolean>>({});
  const [loadingPayments, setLoadingPayments] = useState<Record<string, boolean>>({});
  const { currency } = useCurrency();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch payment details from profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('payment_details')
          .eq('id', user.id)
          .single();

        if (profileData?.payment_details) {
          setPaymentDetails(profileData.payment_details);
        }

        // Fetch appointments for current month
        const startDate = startOfMonth(currentDate);
        const endDate = endOfMonth(currentDate);

        const { data: appointmentsData, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('therapist_id', user.id)
          .gte('session_date', startDate.toISOString())
          .lte('session_date', endDate.toISOString())
          .order('session_date', { ascending: false });

        if (error) throw error;
        setAppointments(appointmentsData);
      } catch (error) {
        toast.error("Error fetching invoice data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentDate]);

  const handleSendInvoice = async (appointment: Appointment) => {
    try {
      setLoadingInvoices(prev => ({ ...prev, [appointment.id]: true }));
      
      if (!paymentDetails) {
        toast.error("Please add payment details in your profile settings first");
        return;
      }

      // Send invoice email
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          type: 'payment_invoice',
          data: {
            client_name: appointment.client_name,
            client_email: appointment.client_email,
            session_date: appointment.session_date,
            price: appointment.price,
            payment_details: paymentDetails
          }
        })
      });

      if (!response.ok) throw new Error('Failed to send invoice');

      // Update appointment status
      const { error } = await supabase
        .from('appointments')
        .update({ payment_status: 'invoice_sent' })
        .eq('id', appointment.id);

      if (error) throw error;

      // Update local state
      setAppointments(appointments.map(app => 
        app.id === appointment.id 
          ? { ...app, payment_status: 'invoice_sent' }
          : app
      ));

      toast.success("Invoice sent successfully");
    } catch (error) {
      toast.error("Failed to send invoice");
    } finally {
      setLoadingInvoices(prev => ({ ...prev, [appointment.id]: false }));
    }
  };

  const handleMarkAsPaid = async (appointment: Appointment) => {
    try {
      setLoadingPayments(prev => ({ ...prev, [appointment.id]: true }));

      const { error } = await supabase
        .from('appointments')
        .update({ 
          payment_status: 'received',
          payment_date: new Date().toISOString()
        })
        .eq('id', appointment.id);

      if (error) throw error;

      // Update local state
      setAppointments(appointments.map(app => 
        app.id === appointment.id 
          ? { ...app, payment_status: 'received', payment_date: new Date().toISOString() }
          : app
      ));

      toast.success("Payment marked as received");
    } catch (error) {
      toast.error("Failed to update payment status");
    } finally {
      setLoadingPayments(prev => ({ ...prev, [appointment.id]: false }));
    }
  };

  const totalEarnings = appointments
    .filter(app => app.payment_status === 'received')
    .reduce((sum, app) => sum + app.price, 0);

  const pendingEarnings = appointments
    .filter(app => app.payment_status !== 'received')
    .reduce((sum, app) => sum + app.price, 0);

  const handlePreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const groupAppointments = (appointments: Appointment[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortByPaymentStatus = (a: Appointment, b: Appointment) => {
      const statusPriority = {
        'pending': 0,
        'invoice_sent': 1,
        'received': 2
      };
      return statusPriority[a.payment_status] - statusPriority[b.payment_status];
    };

    return {
      today: appointments
        .filter(app => {
          const appDate = new Date(app.session_date);
          appDate.setHours(0, 0, 0, 0);
          return appDate.getTime() === today.getTime();
        })
        .sort(sortByPaymentStatus),
      recent: appointments
        .filter(app => {
          const appDate = new Date(app.session_date);
          appDate.setHours(0, 0, 0, 0);
          return appDate < today;
        })
        .sort(sortByPaymentStatus),
      upcoming: appointments
        .filter(app => {
          const appDate = new Date(app.session_date);
          appDate.setHours(0, 0, 0, 0);
          return appDate > today;
        })
        .sort(sortByPaymentStatus)
    };
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex items-center bg-primary/5 rounded-lg p-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousMonth}
            className="hover:bg-primary/10 text-primary"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-medium px-4 text-primary">
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
      
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-500">Monthly Total</span>
            <span className="text-3xl font-bold text-gray-900">
              {formatCurrency(totalEarnings + pendingEarnings)}
            </span>
          </div>

          <div className="h-12 w-px bg-gray-200" />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-500">Received</span>
            </div>
            <span className="text-3xl font-bold text-green-600">
              {formatCurrency(totalEarnings)}
            </span>
          </div>

          <div className="h-12 w-px bg-gray-200" />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-gray-500">Pending</span>
            </div>
            <span className="text-3xl font-bold text-amber-600">
              {formatCurrency(pendingEarnings)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Today's Appointments */}
        {groupAppointments(appointments).today.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Today</h2>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Client</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Session Details</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Price</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500">Status</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupAppointments(appointments).today.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="py-4 px-4">
                        <div className="font-medium">{appointment.client_name}</div>
                        <div className="text-sm text-gray-500">{appointment.client_email}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="h-4 w-4" />
                          {format(new Date(appointment.session_date), "MMM d, yyyy")} · {format(new Date(appointment.session_date), "p")} · {appointment.session_length} mins
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 mt-1">
                          {appointment.session_type === 'video' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium">
                        {formatCurrency(appointment.price)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs
                          ${appointment.payment_status === 'received' ? 'bg-green-100 text-green-700' : 
                            appointment.payment_status === 'invoice_sent' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'}
                        `}>
                          {appointment.payment_status === 'received' ? 'Payment received' :
                           appointment.payment_status === 'invoice_sent' ? 'Invoice sent' :
                           'Payment pending'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {appointment.payment_status === 'pending' ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            onClick={() => handleSendInvoice(appointment)}
                            disabled={loadingInvoices[appointment.id]}
                          >
                            {loadingInvoices[appointment.id] ? (
                              <>
                                <span className="loading loading-spinner loading-xs mr-0.5" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-0.5" />
                                Send Invoice
                              </>
                            )}
                          </Button>
                        ) : appointment.payment_status === 'invoice_sent' ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            onClick={() => handleMarkAsPaid(appointment)}
                            disabled={loadingPayments[appointment.id]}
                          >
                            {loadingPayments[appointment.id] ? (
                              <>
                                <span className="loading loading-spinner loading-xs mr-0.5" />
                                Updating...
                              </>
                            ) : (
                              'Mark as Paid'
                            )}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Appointments */}
        {groupAppointments(appointments).recent.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent</h2>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Client</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Session Details</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Price</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500">Status</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupAppointments(appointments).recent.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="py-4 px-4">
                        <div className="font-medium">{appointment.client_name}</div>
                        <div className="text-sm text-gray-500">{appointment.client_email}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="h-4 w-4" />
                          {format(new Date(appointment.session_date), "MMM d, yyyy")} · {format(new Date(appointment.session_date), "p")} · {appointment.session_length} mins
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 mt-1">
                          {appointment.session_type === 'video' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium">
                        {formatCurrency(appointment.price)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs
                          ${appointment.payment_status === 'received' ? 'bg-green-100 text-green-700' : 
                            appointment.payment_status === 'invoice_sent' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'}
                        `}>
                          {appointment.payment_status === 'received' ? 'Payment received' :
                           appointment.payment_status === 'invoice_sent' ? 'Invoice sent' :
                           'Payment pending'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {appointment.payment_status === 'pending' ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            onClick={() => handleSendInvoice(appointment)}
                            disabled={loadingInvoices[appointment.id]}
                          >
                            {loadingInvoices[appointment.id] ? (
                              <>
                                <span className="loading loading-spinner loading-xs mr-0.5" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-0.5" />
                                Send Invoice
                              </>
                            )}
                          </Button>
                        ) : appointment.payment_status === 'invoice_sent' ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            onClick={() => handleMarkAsPaid(appointment)}
                            disabled={loadingPayments[appointment.id]}
                          >
                            {loadingPayments[appointment.id] ? (
                              <>
                                <span className="loading loading-spinner loading-xs mr-0.5" />
                                Updating...
                              </>
                            ) : (
                              'Mark as Paid'
                            )}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        {groupAppointments(appointments).upcoming.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Client</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Session Details</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500">Price</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500">Status</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupAppointments(appointments).upcoming.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="py-4 px-4">
                        <div className="font-medium">{appointment.client_name}</div>
                        <div className="text-sm text-gray-500">{appointment.client_email}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="h-4 w-4" />
                          {format(new Date(appointment.session_date), "MMM d, yyyy")} · {format(new Date(appointment.session_date), "p")} · {appointment.session_length} mins
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 mt-1">
                          {appointment.session_type === 'video' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium">
                        {formatCurrency(appointment.price)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs
                          ${appointment.payment_status === 'received' ? 'bg-green-100 text-green-700' : 
                            appointment.payment_status === 'invoice_sent' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'}
                        `}>
                          {appointment.payment_status === 'received' ? 'Payment received' :
                           appointment.payment_status === 'invoice_sent' ? 'Invoice sent' :
                           'Payment pending'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {appointment.payment_status === 'pending' ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            onClick={() => handleSendInvoice(appointment)}
                            disabled={loadingInvoices[appointment.id]}
                          >
                            {loadingInvoices[appointment.id] ? (
                              <>
                                <span className="loading loading-spinner loading-xs mr-0.5" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-0.5" />
                                Send Invoice
                              </>
                            )}
                          </Button>
                        ) : appointment.payment_status === 'invoice_sent' ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            onClick={() => handleMarkAsPaid(appointment)}
                            disabled={loadingPayments[appointment.id]}
                          >
                            {loadingPayments[appointment.id] ? (
                              <>
                                <span className="loading loading-spinner loading-xs mr-0.5" />
                                Updating...
                              </>
                            ) : (
                              'Mark as Paid'
                            )}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Show message if no appointments */}
        {appointments.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No appointments found for this month
          </div>
        )}
      </div>
    </div>
  );
} 