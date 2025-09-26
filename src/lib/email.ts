import { Resend } from 'resend';
import { supabase } from '@/integrations/supabase/client';
import { formatDateWithTimezone } from '@/lib/timezone';

// Initialize Resend with your API key
const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export const emailService = {
  // Send appointment confirmation to client
  async sendAppointmentConfirmation(appointment: {
    client_name: string;
    client_email: string;
    session_date: string;
    session_type: string;
    session_length: number;
    client_timezone?: string;
    formatted_session_date?: string;
  }) {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Use the session token
        },
        body: JSON.stringify({
          type: 'appointment_confirmation',
          data: {
            ...appointment,
            // Use the formatted_session_date if provided, otherwise format it here
            formatted_session_date: appointment.formatted_session_date || 
              (appointment.client_timezone 
                ? formatDateWithTimezone(appointment.session_date, appointment.client_timezone, 'PPP p')
                : appointment.session_date)
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      throw error;
    }
  },

  // Send appointment cancellation to client
  async sendAppointmentCancellation(appointment: {
    client_name: string;
    client_email: string;
    session_date: string;
    session_length: number;
    session_type: 'video' | 'in_person';
    location?: string;
    therapist_name: string;
    therapist_photo_url?: string;
    client_timezone?: string;
    formatted_session_date?: string;
  }) {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Use the session token
        },
        body: JSON.stringify({
          type: 'appointment_cancellation',
          data: {
            ...appointment,
            // Use the formatted_session_date if provided, otherwise format it here
            formatted_session_date: appointment.formatted_session_date || 
              (appointment.client_timezone 
                ? formatDateWithTimezone(appointment.session_date, appointment.client_timezone, 'PPP p')
                : appointment.session_date)
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to send cancellation email:', error);
      throw error;
    }
  },

  // Send appointment reminder
  async sendAppointmentReminder(appointment: {
    client_name: string;
    client_email: string;
    session_date: string;
    session_type: 'video' | 'in_person';
    session_length: number;
    location?: string;
    therapist_name: string;
    therapist_photo_url?: string;
    video_link?: string;
    client_timezone?: string;
    formatted_session_date?: string;
  }) {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Use the session token
        },
        body: JSON.stringify({
          type: 'appointment_reminder',
          data: {
            ...appointment,
            // Use the formatted_session_date if provided, otherwise format it here
            formatted_session_date: appointment.formatted_session_date || 
              (appointment.client_timezone 
                ? formatDateWithTimezone(appointment.session_date, appointment.client_timezone, 'PPP p')
                : appointment.session_date)
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      throw error;
    }
  },

  // Send payment invoice
  async sendPaymentInvoice(data: {
    client_name: string;
    client_email: string;
    session_date: string;
    price: number;
    payment_details: string;
    client_timezone?: string;
    formatted_session_date?: string;
  }) {
    try {
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
            ...data,
            // Use the formatted_session_date if provided, otherwise format it here
            formatted_session_date: data.formatted_session_date || 
              (data.client_timezone 
                ? formatDateWithTimezone(data.session_date, data.client_timezone, 'PPP p')
                : data.session_date)
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to send payment invoice:', error);
      throw error;
    }
  }
}; 