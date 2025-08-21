import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.therasuite.app',  // Always use production URL
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Base64 encode the API key
const DYTE_BASE64_AUTH = btoa(`${Deno.env.get('DYTE_ORG_ID')}:${Deno.env.get('DYTE_API_KEY')}`);

serve(async (req) => {
  // Log request details for debugging
  console.log('Request origin:', req.headers.get('origin'));
  console.log('Environment:', Deno.env.get('ENVIRONMENT'));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    // Set CORS headers based on the request origin
    const origin = req.headers.get('origin');
    const headers = {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin === 'http://localhost:8080' ? origin : 'https://www.therasuite.app'
    };
    
    console.log('Responding to OPTIONS with headers:', headers);
    return new Response('ok', { headers })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { appointmentId, therapistId, clientId } = await req.json()
    
    console.log('Received parameters:', { appointmentId, therapistId, clientId })
    
    if (!appointmentId || !therapistId || !clientId) {
      throw new Error(`Missing required parameters: appointmentId=${appointmentId}, therapistId=${therapistId}, clientId=${clientId}`)
    }

    // Create a meeting using Dyte's API
    const response = await fetch('https://api.dyte.io/v2/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DYTE_BASE64_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Therapy Session - ${appointmentId}`,
        preferred_region: 'ap-south-1',
        record_on_start: false,
      }),
    })

    const meetingResponse = await response.json()
    console.log('Dyte API Response:', meetingResponse)

    if (!response.ok || !meetingResponse.success) {
      throw new Error(`Dyte API error: ${JSON.stringify(meetingResponse)}`)
    }

    const meeting = meetingResponse.data
    if (!meeting || !meeting.id) {
      throw new Error(`Invalid meeting data: ${JSON.stringify(meetingResponse)}`)
    }

    // Create participant tokens for both therapist and client
    const [therapistToken, clientToken] = await Promise.all([
      createParticipantToken(meeting.id, 'host', therapistId),
      createParticipantToken(meeting.id, 'participant', clientId),
    ])

    // Update the appointment with the meeting details
    const { error: updateError } = await supabaseClient
      .from('appointments')
      .update({
        video_meeting_id: meeting.id,
        video_therapist_token: therapistToken,
        video_client_token: clientToken,
      })
      .eq('id', appointmentId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: meeting.id,
      }),
      {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Origin': req.headers.get('origin') === 'http://localhost:8080' 
            ? 'http://localhost:8080' 
            : 'https://www.therasuite.app',
          'Content-Type': 'application/json'
        },
      }
    )
  } catch (error) {
    console.error('Error creating meeting:', error)
    console.error('Request origin:', req.headers.get('origin'))
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create meeting',
        details: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Origin': req.headers.get('origin') === 'http://localhost:8080' 
            ? 'http://localhost:8080' 
            : 'https://www.therasuite.app',
          'Content-Type': 'application/json'
        },
      }
    )
  }
})

async function createParticipantToken(meetingId: string, role: 'host' | 'participant', participantId: string) {
  console.log('Creating participant token:', { meetingId, role, participantId })
  
  const response = await fetch(`https://api.dyte.io/v2/meetings/${meetingId}/participants`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${DYTE_BASE64_AUTH}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: role === 'host' ? 'Therapist' : 'Client',
      preset_name: role === 'host' ? 'group_call_host' : 'group_call_participant',
      custom_participant_id: participantId,
    }),
  })

  const participantResponse = await response.json()
  console.log('Dyte Participant API Response:', participantResponse)

  if (!response.ok || !participantResponse.success) {
    throw new Error(`Failed to create participant token: ${JSON.stringify(participantResponse)}`)
  }

  if (!participantResponse.data || !participantResponse.data.token) {
    throw new Error(`Invalid participant data: ${JSON.stringify(participantResponse)}`)
  }

  return participantResponse.data.token
}