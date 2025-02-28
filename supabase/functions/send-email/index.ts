import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@1.1.0";
import { corsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// Common email template wrapper
const emailTemplate = (content: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { 
          font-family: system-ui, -apple-system, sans-serif;
          line-height: 1.5;
          color: #374151;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .logo {
          color: #5b21b6;
          font-size: 24px;
          font-weight: bold;
          text-decoration: none;
        }
        .content {
          padding: 20px 0;
        }
        .details-box {
          background-color: #f3f4f6;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          padding: 20px 0;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #5b21b6;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 6px;
          margin: 10px 0;
          font-weight: 500;
        }
        .button, .button:link, .button:visited, .button:hover, .button:active {
          color: #ffffff !important;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">TheraSuite</div>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} TheraSuite. All rights reserved.</p>
          <p>This email was sent automatically. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
  </html>
`;

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
          from: 'appointments@therasuite.app',
          to: data.client_email,
          subject: `${data.therapist_name} has booked an appointment for you`,
          html: emailTemplate(`
            <h1>Appointment Confirmation</h1>
            <p>Dear ${data.client_name},</p>

            <div class="details-box">
              <div style="display: flex; align-items: center; margin-bottom: 20px;">
                ${data.therapist_photo_url ? 
                  `<img src="${data.therapist_photo_url}" alt="Therapist" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px;" />` 
                  : ''
                }
                <div>
                  <p><strong>Your Therapist:</strong><br/>
                  ${data.therapist_name}</p>
                </div>
              </div>

              <h2>Appointment Details</h2>
              <ul style="list-style: none; padding-left: 0;">
                <li>📅 <strong>Date:</strong> ${new Date(data.session_date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }).split(',')[0]}</li>
                <li>⏰ <strong>Time:</strong> ${new Date(data.session_date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: true })}</li>
                <li>⌛ <strong>Duration:</strong> ${data.session_length} minutes</li>
                <li>💻 <strong>Type:</strong> ${data.session_type === 'video' ? 'Video Call' : 'In-Person'}</li>
                ${data.session_type === 'in_person' && data.location ? 
                  `<li>📍 <strong>Location:</strong> ${data.location}</li>` 
                  : ''
                }
              </ul>
              ${data.session_type === 'video' ? 
                '<p><em>You will receive a video call link at the time of the appointment.</em></p>' 
                : ''
              }
            </div>

            <p>Thank you for booking with us!</p>
          `)
        });
        break;

      case 'appointment_cancellation':
        await resend.emails.send({
          from: 'appointments@therasuite.app',
          to: data.client_email,
          subject: 'Appointment Cancellation',
          html: emailTemplate(`
            <h1>Appointment Cancelled</h1>
            <p>Dear ${data.client_name},</p>
            
            <div class="details-box">
              <h2>Cancelled Appointment Details</h2>
              <p>Your appointment scheduled for ${new Date(data.session_date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} has been cancelled.</p>
            </div>

            <p>If you would like to reschedule, please book a new appointment.</p>
            <p>We apologize for any inconvenience.</p>
          `)
        });
        break;

      case 'appointment_reminder':
        await resend.emails.send({
          from: 'appointments@therasuite.app',
          to: data.client_email,
          subject: 'Appointment Reminder',
          html: emailTemplate(`
            <h1>Appointment Reminder</h1>
            <p>Dear ${data.client_name},</p>

            <div class="details-box">
              <h2>Tomorrow's Appointment</h2>
              <p>This is a reminder about your appointment tomorrow at ${new Date(data.session_date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: true })}.</p>
              ${data.session_type === 'video' && data.video_link 
                ? `<p>Join your video call here: <a href="${data.video_link}" class="button">Join Video Call</a></p>`
                : ''
              }
            </div>

            <p>We look forward to seeing you!</p>
          `)
        });
        break;

      case 'video_call_link':
        await resend.emails.send({
          from: 'appointments@therasuite.app',
          to: data.client_email,
          subject: 'Your Video Session is Starting',
          html: emailTemplate(`
            <h1>Your Video Session is Starting</h1>
            <p>Dear ${data.client_name},</p>

            <div class="details-box">
              <h2>Video Session Details</h2>
              <p>Your therapist has started the video session. Please click the button below to join:</p>
              <a href="${data.video_link}" class="button" style="color: #ffffff !important;">Join Video Session</a>
              <p>If you have any issues joining, please contact your therapist.</p>
            </div>

            <p>Best regards,<br/>TheraSuite Team</p>
          `)
        });
        break;

      case 'payment_invoice':
        await resend.emails.send({
          from: 'payments@therasuite.app',
          to: data.client_email,
          subject: 'Payment Invoice for Your Session',
          html: emailTemplate(`
            <h1>Payment Invoice</h1>
            <p>Dear ${data.client_name},</p>

            <div class="details-box">
              <h2>Invoice Details</h2>
              <p>Here is your invoice for the session on ${new Date(data.session_date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}.</p>
              <p><strong>Amount Due: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.price)}</strong></p>
              
              <h3>Payment Details:</h3>
              <pre style="background: #fff; padding: 10px; border-radius: 4px;">${data.payment_details}</pre>
            </div>

            <p>Please complete the payment at your earliest convenience.</p>
            <p>Thank you for your business!</p>
          `)
        });
        break;

      case 'appointment_rescheduled':
        await resend.emails.send({
          from: 'appointments@therasuite.app',
          to: data.client_email,
          subject: `${data.therapist_name} has rescheduled your appointment`,
          html: emailTemplate(`
            <h1>Appointment Rescheduled</h1>
            <p>Dear ${data.client_name},</p>

            <div class="details-box">
              <div style="display: flex; align-items: center; margin-bottom: 20px;">
                ${data.therapist_photo_url ? 
                  `<img src="${data.therapist_photo_url}" alt="Therapist" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px;" />` 
                  : ''
                }
                <div>
                  <p><strong>Your Therapist:</strong><br/>
                  ${data.therapist_name}</p>
                </div>
              </div>

              <h2>Updated Appointment Details</h2>
              <p>Your appointment has been rescheduled from:</p>
              <p><strong>Old Date & Time:</strong><br/>
              ${new Date(data.old_date).toLocaleString('en-US', { 
                timeZone: 'Asia/Kolkata',
                dateStyle: 'full',
                timeStyle: 'short'
              })}</p>
              
              <p><strong>New Date & Time:</strong><br/>
              ${new Date(data.session_date).toLocaleString('en-US', { 
                timeZone: 'Asia/Kolkata',
                dateStyle: 'full',
                timeStyle: 'short'
              })}</p>

              <ul style="list-style: none; padding-left: 0; margin-top: 20px;">
                <li>⌛ <strong>Duration:</strong> ${data.session_length} minutes</li>
                <li>💻 <strong>Type:</strong> ${data.session_type === 'video' ? 'Video Call' : 'In-Person'}</li>
              </ul>
              ${data.session_type === 'video' ? 
                '<p><em>You will receive a video call link before the appointment.</em></p>' 
                : ''
              }
            </div>

            <p>If this new time doesn't work for you, please contact your therapist to reschedule.</p>
            <p>Thank you for your understanding!</p>
          `)
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