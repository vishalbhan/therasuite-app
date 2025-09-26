// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@1.1.0";
import { corsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// Helper functions to format dates/times in client's timezone
function getOrdinalSuffix(day: number): string {
  const j = day % 10, k = day % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

function formatDateInTimezone(dateInput: string | Date, timezone: string = 'Asia/Kolkata'): string {
  const date = new Date(dateInput);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);
  const dayStr = parts.find(p => p.type === 'day')?.value || '';
  const monthStr = parts.find(p => p.type === 'month')?.value || '';
  const yearStr = parts.find(p => p.type === 'year')?.value || '';
  const dayNum = parseInt(dayStr, 10);
  const suffix = getOrdinalSuffix(dayNum);
  return `${dayNum}${suffix} ${monthStr} ${yearStr}`;
}

function formatTimeInTimezone(dateInput: string | Date, timezone: string = 'Asia/Kolkata'): string {
  return new Date(dateInput).toLocaleString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
}

function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const timeZoneName = parts.find(part => part.type === 'timeZoneName');
    return timeZoneName?.value || timezone;
  } catch (error) {
    console.warn(`Could not get timezone abbreviation for ${timezone}:`, error);
    return timezone;
  }
}

// Legacy functions for backward compatibility
function formatDateIST(dateInput: string | Date): string {
  return formatDateInTimezone(dateInput, 'Asia/Kolkata');
}
function formatTimeIST(dateInput: string | Date): string {
  return formatTimeInTimezone(dateInput, 'Asia/Kolkata');
}

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
        // Create Calendar URL
        const encodeForCalendar = (text: string) => encodeURIComponent(text.replace(/\n/g, ' '));
        const startDate = new Date(data.session_date);
        const endDate = new Date(startDate.getTime() + data.session_length * 60000);
        
        const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${
          encodeForCalendar(`Therapy Session with ${data.therapist_name}`)
        }&dates=${
          startDate.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')
        }/${
          endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')
        }&details=${
          encodeForCalendar(`Your therapy session with ${data.therapist_name}`)
        }&location=${
          data.location ? encodeForCalendar(data.location) : ''
        }`;

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
                <li>📅 <strong>Date & Time:</strong> ${data.formatted_session_date || `${formatDateIST(data.session_date)} at ${formatTimeIST(data.session_date)}`}</li>
                <li>⌛ <strong>Duration:</strong> ${data.session_length} minutes</li>
                <li>💻 <strong>Type:</strong> ${data.session_type === 'video' ? 'Video Call' : 'In-Person'}</li>
                ${data.session_type === 'in_person' && data.location ? 
                  `<li>📍 <strong>Location:</strong> ${data.location}</li>` 
                  : ''
                }
              </ul>
              ${data.session_type === 'video' ? 
                `<p><em>
                  'You will receive a video call link at the time of the appointment.'
                  </em></p>` 
                : `<p style="text-align: center;">
                    <a href="${googleCalendarUrl}" target="_blank" class="button">Add to Google Calendar</a>
                   </p>`
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
          subject: `${data.therapist_name} has cancelled your appointment`,
          html: emailTemplate(`
            <h1>Appointment Cancelled</h1>
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

              <h2>Cancelled Appointment Details</h2>
              <ul style="list-style: none; padding-left: 0;">
                <li>📅 <strong>Date & Time:</strong> ${data.formatted_session_date || `${formatDateIST(data.session_date)} at ${formatTimeIST(data.session_date)}`}</li>
                <li>⌛ <strong>Duration:</strong> ${data.session_length} minutes</li>
                <li>💻 <strong>Type:</strong> ${data.session_type === 'video' ? 'Video Call' : 'In-Person'}</li>
                ${data.session_type === 'in_person' && data.location ? 
                  `<li>📍 <strong>Location:</strong> ${data.location}</li>` 
                  : ''
                }
              </ul>
            </div>

            <p>If you would like to reschedule, please contact your therapist or book a new appointment through our platform.</p>
            <p>We apologize for any inconvenience this may have caused.</p>
            
            <p>Best regards,<br/>TheraSuite Team</p>
          `)
        });
        break;

      case 'appointment_reminder': {
        // Mirror appointment confirmation content but with different subject and title
        const encodeForCalendar = (text: string) => encodeURIComponent(text.replace(/\n/g, ' '));
        const startDate = new Date(data.session_date);
        const endDate = new Date(startDate.getTime() + (data.session_length || 0) * 60000);

        const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${
          encodeForCalendar(`Therapy Session with ${data.therapist_name}`)
        }&dates=${
          startDate.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')
        }/${
          endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')
        }&details=${
          encodeForCalendar(`Your therapy session with ${data.therapist_name}`)
        }&location=${
          data.location ? encodeForCalendar(data.location) : ''
        }`;

        await resend.emails.send({
          from: 'appointments@therasuite.app',
          to: data.client_email,
          subject: 'Reminder for Upcoming Session',
          html: emailTemplate(`
            <h1>Appointment Reminder</h1>
            <p>Dear ${data.client_name},</p>

            <div class="details-box">
              <div style="display: flex; align-items: center; margin-bottom: 20px;">
                ${data.therapist_photo_url ? 
                  `<img src="${data.therapist_photo_url}" alt="Therapist" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px;" />` 
                  : ''
                }
                <div>
                  <p><strong>Your Therapist:</strong><br/>
                  ${data.therapist_name || 'Your Therapist'}</p>
                </div>
              </div>

              <h2>Appointment Details</h2>
              <ul style="list-style: none; padding-left: 0;">
                <li>📅 <strong>Date & Time:</strong> ${data.formatted_session_date || `${formatDateIST(data.session_date)} at ${formatTimeIST(data.session_date)}`}</li>
                <li>⌛ <strong>Duration:</strong> ${data.session_length} minutes</li>
                <li>💻 <strong>Type:</strong> ${data.session_type === 'video' ? 'Video Call' : 'In-Person'}</li>
                ${data.session_type === 'in_person' && data.location ? 
                  `<li>📍 <strong>Location:</strong> ${data.location}</li>` 
                  : ''
                }
              </ul>
              ${data.session_type === 'video' ? 
                `<p><em>
                  'You will receive a video call link at the time of the appointment.'
                  </em></p>` 
                : `<p style="text-align: center;">
                    <a href="${googleCalendarUrl}" target="_blank" class="button">Add to Google Calendar</a>
                   </p>`
              }
            </div>

            <p>We look forward to seeing you!</p>
          `)
        });
        break;
      }

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
              ${data.video_provider === 'therasuite' ? `
                <p>Your therapist has started the video session. Please click the button below to join:</p>
                <a href="${data.video_link}" class="button" style="color: #ffffff !important;">Join TheraSuite Video</a>
              ` : `
                <p>Your therapist has started the ${data.video_provider === 'google_meet' ? 'Google Meet' : 'Zoom'} session. Please click the button below to join:</p>
                <a href="${data.video_link}" class="button" style="color: #ffffff !important;">Join ${data.video_provider === 'google_meet' ? 'Google Meet' : 'Zoom'}</a>
              `}
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

              <h2>Invoice Details</h2>
              <p>Here is your invoice for the session on ${data.formatted_session_date || `${formatDateIST(data.session_date)} at ${formatTimeIST(data.session_date)}`}.</p>
              <h3>Amount Due: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.price)}</h3>
              <br/>
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
              ${data.formatted_old_date || `${formatDateIST(data.old_date)} at ${formatTimeIST(data.old_date)}`}</p>
              
              <p><strong>New Date & Time:</strong><br/>
              ${data.formatted_session_date || `${formatDateIST(data.session_date)} at ${formatTimeIST(data.session_date)}`}</p>

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