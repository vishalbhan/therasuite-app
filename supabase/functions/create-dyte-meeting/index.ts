import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Base64 encode the API key
const DYTE_BASE64_AUTH = btoa(`${Deno.env.get('DYTE_ORG_ID')}:${Deno.env.get('DYTE_API_KEY')}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { appointmentId, therapistId, clientEmail } = await req.json()

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
    if (!meetingResponse.success) {
      throw new Error(`Failed to create meeting: ${meetingResponse.message}`)
    }

    const meeting = meetingResponse.data

    // Create participant tokens with the same auth
    const [therapistToken, clientToken] = await Promise.all([
      createParticipantToken(meeting.id, 'host', therapistId, DYTE_BASE64_AUTH),
      createParticipantToken(meeting.id, 'participant', clientEmail, DYTE_BASE64_AUTH),
    ])

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store meeting details
    const { error } = await supabase
      .from('video_meetings')
      .insert({
        appointment_id: appointmentId,
        meeting_id: meeting.id,
        therapist_token: therapistToken,
        client_token: clientToken,
      })

    if (error) throw error

    return new Response(
      JSON.stringify({
        authToken: therapistToken,
        roomName: meeting.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Dyte API Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

async function createParticipantToken(
  meetingId: string, 
  role: 'host' | 'participant', 
  clientId: string,
  auth: string
) {
  const response = await fetch(`https://api.dyte.io/v2/meetings/${meetingId}/participants`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: clientId,
      preset_name: role === 'host' ? 'group_call_host' : 'group_call_participant',
      custom_participant_id: clientId,
    }),
  })

  const participantResponse = await response.json()
  if (!participantResponse.success) {
    throw new Error(`Failed to create participant token: ${participantResponse.message}`)
  }

  return participantResponse.data.token
}