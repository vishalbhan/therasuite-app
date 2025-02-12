import { supabase } from '@/integrations/supabase/client';

export async function POST(req: Request) {
  try {
    const { appointmentId, therapistId, clientEmail } = await req.json();

    // Create a meeting using Dyte's API
    const response = await fetch('https://api.dyte.io/v2/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.DYTE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Therapy Session - ${appointmentId}`,
        preferred_region: 'ap-south-1', // For India
        record_on_start: false,
      }),
    });

    const { data: meeting } = await response.json();

    // Create participant tokens for both therapist and client
    const [therapistToken, clientToken] = await Promise.all([
      createParticipantToken(meeting.id, 'host', therapistId),
      createParticipantToken(meeting.id, 'participant', clientEmail),
    ]);

    // Store meeting details in your database
    const { error } = await supabase
      .from('video_meetings')
      .insert({
        appointment_id: appointmentId,
        meeting_id: meeting.id,
        therapist_token: therapistToken,
        client_token: clientToken,
      });

    if (error) throw error;

    return new Response(JSON.stringify({
      authToken: therapistToken,
      roomName: meeting.id,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return new Response(JSON.stringify({ error: 'Failed to create meeting' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function createParticipantToken(meetingId: string, role: 'host' | 'participant', clientId: string) {
  const response = await fetch(`https://api.dyte.io/v2/meetings/${meetingId}/participants`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.DYTE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: clientId,
      preset_name: role === 'host' ? 'therapist_preset' : 'client_preset',
      custom_participant_id: clientId,
    }),
  });

  const { data } = await response.json();
  return data.token;
} 