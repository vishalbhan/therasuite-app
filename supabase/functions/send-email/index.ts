import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@1.1.0";
import { corsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, data } = await req.json();

    switch (type) {
      case 'appointment_confirmation':
        await resend.emails.send({
          from: 'appointments@yourdomain.com',
          to: data.client_email,
          subject: 'Appointment Confirmation',
          html: `
            <h1>Appointment Confirmation</h1>
            <p>Dear ${data.client_name},</p>
            <p>Your appointment has been confirmed for:</p>
            <ul>
              <li>Date: ${new Date(data.session_date).toLocaleDateString()}</li>
              <li>Time: ${new Date(data.session_date).toLocaleTimeString()}</li>
              <li>Duration: ${data.session_length} minutes</li>
              <li>Type: ${data.session_type === 'video' ? 'Video Call' : 'In-Person'}</li>
            </ul>
            ${data.session_type === 'video' ? '<p>You will receive a video call link before the appointment.</p>' : ''}
            <p>Thank you for booking with us!</p>
          `
        });
        break;

      case 'appointment_cancellation':
        await resend.emails.send({
          from: 'appointments@yourdomain.com',
          to: data.client_email,
          subject: 'Appointment Cancellation',
          html: `
            <h1>Appointment Cancelled</h1>
            <p>Dear ${data.client_name},</p>
            <p>Your appointment scheduled for ${new Date(data.session_date).toLocaleString()} has been cancelled.</p>
            <p>If you would like to reschedule, please book a new appointment.</p>
            <p>We apologize for any inconvenience.</p>
          `
        });
        break;

      case 'appointment_reminder':
        await resend.emails.send({
          from: 'appointments@yourdomain.com',
          to: data.client_email,
          subject: 'Appointment Reminder',
          html: `
            <h1>Appointment Reminder</h1>
            <p>Dear ${data.client_name},</p>
            <p>This is a reminder about your appointment tomorrow at ${new Date(data.session_date).toLocaleTimeString()}.</p>
            ${data.session_type === 'video' && data.video_link 
              ? `<p>Join your video call here: <a href="${data.video_link}">${data.video_link}</a></p>`
              : ''
            }
            <p>We look forward to seeing you!</p>
          `
        });
        break;

      default:
        throw new Error('Invalid email type');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 