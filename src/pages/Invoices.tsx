import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, Video, MapPin, Mail, ChevronLeft, ChevronRight, Calendar, MoreVertical, CheckCircle, Send, Undo2 } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

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
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
}

export default function Invoices() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadingInvoices, setLoadingInvoices] = useState<Record<string, boolean>>({});
  const [loadingPayments, setLoadingPayments] = useState<Record<string, boolean>>({});
  const [loadingNotPaid, setLoadingNotPaid] = useState<Record<string, boolean>>({});
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
          .in('status', ['scheduled', 'completed'])
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

  const handleSendInvoice = async (appointment: Appointment, isResend = false) => {
    try {
      setLoadingInvoices(prev => ({ ...prev, [appointment.id]: true }));
      
      if (!paymentDetails) {
        toast.error("Please add payment details in your profile settings first");
        return;
      }

      // Get therapist details
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session');

      const { data: therapistProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, photo_url')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!therapistProfile) throw new Error('Therapist profile not found');

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
            payment_details: paymentDetails,
            therapist_name: therapistProfile.full_name,
            therapist_photo_url: therapistProfile.photo_url
          }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Email function error:", errorBody);
        throw new Error('Failed to send invoice email');
      }

      // Update appointment status only if it's not a resend or if status is pending
      if (!isResend && appointment.payment_status === 'pending') {
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ payment_status: 'invoice_sent' })
          .eq('id', appointment.id);

        if (updateError) throw updateError;

        // Update local state
        setAppointments(appointments.map(app =>
          app.id === appointment.id
            ? { ...app, payment_status: 'invoice_sent' }
            : app
        ));
      }

      toast.success(isResend ? "Invoice resent successfully" : "Invoice sent successfully");
    } catch (error: any) {
      console.error("Error sending/resending invoice:", error);
      toast.error(error.message || "Failed to send invoice");
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

  const handleMarkAsNotPaid = async (appointment: Appointment) => {
    try {
      setLoadingNotPaid(prev => ({ ...prev, [appointment.id]: true }));

      const { error } = await supabase
        .from('appointments')
        .update({
          payment_status: 'pending',
          payment_date: null
        })
        .eq('id', appointment.id);

      if (error) throw error;

      // Update local state
      setAppointments(appointments.map(app =>
        app.id === appointment.id
          ? { ...app, payment_status: 'pending', payment_date: undefined }
          : app
      ));

      toast.success("Payment status reverted to pending");
    } catch (error) {
      toast.error("Failed to update payment status");
    } finally {
      setLoadingNotPaid(prev => ({ ...prev, [appointment.id]: false }));
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

    const sortByDate = (a: Appointment, b: Appointment) => {
      return new Date(b.session_date).getTime() - new Date(a.session_date).getTime();
    };

    const sortByDateAscending = (a: Appointment, b: Appointment) => {
      return new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
    };

    return {
      today: appointments
        .filter(app => {
          const appDate = new Date(app.session_date);
          appDate.setHours(0, 0, 0, 0);
          return appDate.getTime() === today.getTime();
        })
        .sort(sortByDate),
      recent: appointments
        .filter(app => {
          const appDate = new Date(app.session_date);
          appDate.setHours(0, 0, 0, 0);
          return appDate < today;
        })
        .sort(sortByDate),
      upcoming: appointments
        .filter(app => {
          const appDate = new Date(app.session_date);
          appDate.setHours(0, 0, 0, 0);
          return appDate > today;
        })
        .sort(sortByDateAscending)
    };
  };

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-medium">{appointment.client_name}</div>
            <div className="text-sm text-gray-500">{appointment.client_email}</div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs
            ${appointment.payment_status === 'received' ? 'bg-green-100 text-green-700' : 
              appointment.payment_status === 'invoice_sent' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'}
          `}>
            {appointment.payment_status === 'received' ? 'Payment received' :
             appointment.payment_status === 'invoice_sent' ? 'Invoice sent' :
             'Payment pending'}
          </div>
        </div>

        <div className="flex items-center text-sm text-gray-500">
          <Clock className="h-4 w-4 mr-2" />
          {format(new Date(appointment.session_date), "MMM d, yyyy 'at' h:mm a")}
        </div>

        <div className="flex items-center text-sm text-gray-500">
          {appointment.session_type === 'video' ? (
            <Video className="h-4 w-4 mr-2" />
          ) : (
            <MapPin className="h-4 w-4 mr-2" />
          )}
          {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'} · {appointment.session_length} mins
        </div>

        <div className="flex items-center text-sm font-medium">
          <Calendar className="h-4 w-4 mr-2" />
          {formatCurrency(appointment.price)}
        </div>

        <div className="flex justify-end items-center space-x-2 pt-3 border-t">
          {appointment.payment_status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50"
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
          )}

          {appointment.payment_status === 'invoice_sent' && (
             <Button
               size="sm"
               variant="outline"
               className="flex-1 text-gray-500 hover:text-green-600 hover:bg-green-50"
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
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-500 hover:text-primary"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {appointment.payment_status === 'pending' && (
                <DropdownMenuItem
                  onClick={() => handleMarkAsPaid(appointment)}
                  disabled={loadingPayments[appointment.id]}
                  className="text-green-600 cursor-pointer"
                >
                  {loadingPayments[appointment.id] ? (
                    <>
                      <span className="loading loading-spinner loading-xs mr-2" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Paid
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {appointment.payment_status === 'invoice_sent' && (
                 <>
                   <DropdownMenuItem
                     onClick={() => handleSendInvoice(appointment, true)}
                     disabled={loadingInvoices[appointment.id]}
                     className="text-blue-600 cursor-pointer"
                   >
                     {loadingInvoices[appointment.id] ? (
                       <>
                         <span className="loading loading-spinner loading-xs mr-2" />
                         Resending...
                       </>
                     ) : (
                       <>
                         <Send className="h-4 w-4 mr-2" />
                         Resend Invoice
                       </>
                     )}
                   </DropdownMenuItem>
                   <DropdownMenuItem
                     onClick={() => handleMarkAsPaid(appointment)}
                     disabled={loadingPayments[appointment.id]}
                     className="text-green-600 cursor-pointer"
                   >
                     {loadingPayments[appointment.id] ? (
                       <>
                         <span className="loading loading-spinner loading-xs mr-2" />
                         Updating...
                       </>
                     ) : (
                       <>
                         <CheckCircle className="h-4 w-4 mr-2" />
                         Mark as Paid
                       </>
                     )}
                   </DropdownMenuItem>
                 </>
              )}
              {appointment.payment_status === 'received' && (
                <DropdownMenuItem
                  onClick={() => handleMarkAsNotPaid(appointment)}
                  disabled={loadingNotPaid[appointment.id]}
                  className="text-red-600 cursor-pointer"
                >
                  {loadingNotPaid[appointment.id] ? (
                    <>
                      <span className="loading loading-spinner loading-xs mr-2" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Mark as not paid
                    </>
                  )}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container px-4 sm:px-6 mx-auto py-6 max-w-[95%] sm:max-w-7xl">
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
        {/* Desktop View */}
        <div className="hidden md:flex justify-between items-center">
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

        {/* Mobile View */}
        <div className="md:hidden space-y-6">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-500">Monthly Total</span>
            <span className="text-3xl font-bold text-gray-900">
              {formatCurrency(totalEarnings + pendingEarnings)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center p-3 rounded-lg bg-green-50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-gray-500">Received</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(totalEarnings)}
              </span>
            </div>

            <div className="flex flex-col items-center p-3 rounded-lg bg-amber-50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm font-medium text-gray-500">Pending</span>
              </div>
              <span className="text-2xl font-bold text-amber-600">
                {formatCurrency(pendingEarnings)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Today's Appointments */}
        {groupAppointments(appointments).today.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Today</h2>
            {/* Desktop View */}
            <div className="hidden md:block rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[200px]">Client</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[300px]">Session Details</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[120px]">Price</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500 w-[150px]">Status</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500 w-[170px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupAppointments(appointments).today.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="py-4 px-4 w-[200px]">
                        <div className="font-medium">{appointment.client_name}</div>
                        <div className="text-sm text-gray-500">{appointment.client_email}</div>
                      </td>
                      <td className="py-4 px-4 w-[300px]">
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
                      <td className="py-4 px-4 font-medium w-[120px]">
                        {formatCurrency(appointment.price)}
                      </td>
                      <td className="py-4 px-4 text-right w-[150px]">
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
                      <td className="py-4 px-4 text-right w-[170px]">
                        <div className="flex items-center justify-end space-x-2">
                          {appointment.payment_status === 'received' && appointment.payment_date && (
                            <div className="text-sm text-gray-500 text-right mr-2">
                              <div>Received on</div>
                              <div>{new Date(appointment.payment_date).toLocaleDateString()}</div>
                              <div className="text-xs">
                                {new Date(appointment.payment_date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          )}
                          {appointment.payment_status === 'pending' && (
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
                          )}
                          {appointment.payment_status === 'invoice_sent' && (
                             <Button
                               size="sm"
                               variant="outline"
                               className="text-gray-500 hover:text-green-600 hover:bg-green-50"
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
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 data-[state=open]:bg-muted"
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {appointment.payment_status === 'pending' && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsPaid(appointment)}
                                  disabled={loadingPayments[appointment.id]}
                                  className="text-green-600 cursor-pointer"
                                >
                                  {loadingPayments[appointment.id] ? (
                                    <>
                                      <span className="loading loading-spinner loading-xs mr-2" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark as Paid
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {appointment.payment_status === 'invoice_sent' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleSendInvoice(appointment, true)}
                                    disabled={loadingInvoices[appointment.id]}
                                    className="text-blue-600 cursor-pointer"
                                  >
                                    {loadingInvoices[appointment.id] ? (
                                      <>
                                        <span className="loading loading-spinner loading-xs mr-2" />
                                        Resending...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Resend Invoice
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleMarkAsPaid(appointment)}
                                    disabled={loadingPayments[appointment.id]}
                                    className="text-green-600 cursor-pointer"
                                  >
                                    {loadingPayments[appointment.id] ? (
                                      <>
                                        <span className="loading loading-spinner loading-xs mr-2" />
                                        Updating...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Mark as Paid
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {appointment.payment_status === 'received' && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsNotPaid(appointment)}
                                  disabled={loadingNotPaid[appointment.id]}
                                  className="text-red-600 cursor-pointer"
                                >
                                  {loadingNotPaid[appointment.id] ? (
                                    <>
                                      <span className="loading loading-spinner loading-xs mr-2" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Undo2 className="h-4 w-4 mr-2" />
                                      Mark as not paid
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {groupAppointments(appointments).today.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Appointments */}
        {groupAppointments(appointments).recent.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Recent</h2>
            {/* Desktop View */}
            <div className="hidden md:block rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[200px]">Client</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[300px]">Session Details</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[120px]">Price</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500 w-[150px]">Status</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500 w-[170px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupAppointments(appointments).recent.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="py-4 px-4 w-[200px]">
                        <div className="font-medium">{appointment.client_name}</div>
                        <div className="text-sm text-gray-500">{appointment.client_email}</div>
                      </td>
                      <td className="py-4 px-4 w-[300px]">
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
                      <td className="py-4 px-4 font-medium w-[120px]">
                        {formatCurrency(appointment.price)}
                      </td>
                      <td className="py-4 px-4 text-right w-[150px]">
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
                      <td className="py-4 px-4 text-right w-[170px]">
                        <div className="flex items-center justify-end space-x-2">
                          {appointment.payment_status === 'received' && appointment.payment_date && (
                            <div className="text-sm text-gray-500 text-right mr-2">
                              <div>Received on</div>
                              <div>{new Date(appointment.payment_date).toLocaleDateString()}</div>
                              <div className="text-xs">
                                {new Date(appointment.payment_date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          )}
                          {appointment.payment_status === 'pending' && (
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
                          )}
                          {appointment.payment_status === 'invoice_sent' && (
                             <Button
                               size="sm"
                               variant="outline"
                               className="text-gray-500 hover:text-green-600 hover:bg-green-50"
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
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 data-[state=open]:bg-muted"
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {appointment.payment_status === 'pending' && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsPaid(appointment)}
                                  disabled={loadingPayments[appointment.id]}
                                  className="text-green-600 cursor-pointer"
                                >
                                  {loadingPayments[appointment.id] ? (
                                    <>
                                      <span className="loading loading-spinner loading-xs mr-2" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark as Paid
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {appointment.payment_status === 'invoice_sent' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleSendInvoice(appointment, true)}
                                    disabled={loadingInvoices[appointment.id]}
                                    className="text-blue-600 cursor-pointer"
                                  >
                                    {loadingInvoices[appointment.id] ? (
                                      <>
                                        <span className="loading loading-spinner loading-xs mr-2" />
                                        Resending...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Resend Invoice
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleMarkAsPaid(appointment)}
                                    disabled={loadingPayments[appointment.id]}
                                    className="text-green-600 cursor-pointer"
                                  >
                                    {loadingPayments[appointment.id] ? (
                                      <>
                                        <span className="loading loading-spinner loading-xs mr-2" />
                                        Updating...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Mark as Paid
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {appointment.payment_status === 'received' && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsNotPaid(appointment)}
                                  disabled={loadingNotPaid[appointment.id]}
                                  className="text-red-600 cursor-pointer"
                                >
                                  {loadingNotPaid[appointment.id] ? (
                                    <>
                                      <span className="loading loading-spinner loading-xs mr-2" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Undo2 className="h-4 w-4 mr-2" />
                                      Mark as not paid
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {groupAppointments(appointments).recent.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        {groupAppointments(appointments).upcoming.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
            {/* Desktop View */}
            <div className="hidden md:block rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[200px]">Client</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[300px]">Session Details</th>
                    <th className="py-4 px-4 text-left font-medium text-gray-500 w-[120px]">Price</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500 w-[150px]">Status</th>
                    <th className="py-4 px-4 text-right font-medium text-gray-500 w-[170px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupAppointments(appointments).upcoming.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="py-4 px-4 w-[200px]">
                        <div className="font-medium">{appointment.client_name}</div>
                        <div className="text-sm text-gray-500">{appointment.client_email}</div>
                      </td>
                      <td className="py-4 px-4 w-[300px]">
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
                      <td className="py-4 px-4 font-medium w-[120px]">
                        {formatCurrency(appointment.price)}
                      </td>
                      <td className="py-4 px-4 text-right w-[150px]">
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
                      <td className="py-4 px-4 text-right w-[170px]">
                        <div className="flex items-center justify-end space-x-2">
                          {appointment.payment_status === 'received' && appointment.payment_date && (
                            <div className="text-sm text-gray-500 text-right mr-2">
                              <div>Received on</div>
                              <div>{new Date(appointment.payment_date).toLocaleDateString()}</div>
                              <div className="text-xs">
                                {new Date(appointment.payment_date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          )}
                          {appointment.payment_status === 'pending' && (
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
                          )}
                          {appointment.payment_status === 'invoice_sent' && (
                             <Button
                               size="sm"
                               variant="outline"
                               className="text-gray-500 hover:text-green-600 hover:bg-green-50"
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
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 data-[state=open]:bg-muted"
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {appointment.payment_status === 'pending' && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsPaid(appointment)}
                                  disabled={loadingPayments[appointment.id]}
                                  className="text-green-600 cursor-pointer"
                                >
                                  {loadingPayments[appointment.id] ? (
                                    <>
                                      <span className="loading loading-spinner loading-xs mr-2" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark as Paid
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {appointment.payment_status === 'invoice_sent' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleSendInvoice(appointment, true)}
                                    disabled={loadingInvoices[appointment.id]}
                                    className="text-blue-600 cursor-pointer"
                                  >
                                    {loadingInvoices[appointment.id] ? (
                                      <>
                                        <span className="loading loading-spinner loading-xs mr-2" />
                                        Resending...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Resend Invoice
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleMarkAsPaid(appointment)}
                                    disabled={loadingPayments[appointment.id]}
                                    className="text-green-600 cursor-pointer"
                                  >
                                    {loadingPayments[appointment.id] ? (
                                      <>
                                        <span className="loading loading-spinner loading-xs mr-2" />
                                        Updating...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Mark as Paid
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {appointment.payment_status === 'received' && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsNotPaid(appointment)}
                                  disabled={loadingNotPaid[appointment.id]}
                                  className="text-red-600 cursor-pointer"
                                >
                                  {loadingNotPaid[appointment.id] ? (
                                    <>
                                      <span className="loading loading-spinner loading-xs mr-2" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Undo2 className="h-4 w-4 mr-2" />
                                      Mark as not paid
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {groupAppointments(appointments).upcoming.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
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