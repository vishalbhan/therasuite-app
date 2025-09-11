import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface NotesData {
  notes: Array<{
    id: string
    session_date: string
    notes: string
    session_type: string
    session_length: number
  }>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Verify the JWT token
    const jwt = authHeader.replace('Bearer ', '')
    const { data: user, error: authError } = await supabaseClient.auth.getUser(jwt)
    
    if (authError || !user) {
      throw new Error('Invalid authorization token')
    }

    const { notes }: NotesData = await req.json()
    
    if (!notes || notes.length === 0) {
      throw new Error('No notes provided')
    }

    // Prepare notes text for OpenAI
    const notesText = notes.map((note, index) => 
      `Session ${index + 1} (${new Date(note.session_date).toLocaleDateString()}, ${note.session_type}, ${note.session_length} min):\n${note.notes}`
    ).join('\n\n')

    // Get Cloudflare AI Gateway configuration
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const cloudflareGatewayId = Deno.env.get('CLOUDFLARE_AI_GATEWAY_ID')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!cloudflareAccountId || !cloudflareGatewayId || !openaiApiKey) {
      throw new Error('Missing Cloudflare AI Gateway or OpenAI configuration')
    }

    // Construct Cloudflare AI Gateway URL
    const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/openai`

    // Call OpenAI via Cloudflare AI Gateway
    const response = await fetch(`${gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional therapy assistant. Analyze the following therapy session notes and provide an overall summary of the client\'s progress and challenges. Keep the summary professional, concise, and focused on therapeutic insights. Also, if possible, offer some tips for the therapist to improve the client\'s progress.'
          },
          {
            role: 'user',
            content: `Please summarize these therapy session notes:\n\n${notesText}`
          }
        ],
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const completion = await response.json()
    const generatedSummary = completion.choices?.[0]?.message?.content

    if (!generatedSummary) {
      throw new Error('No summary generated from OpenAI')
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: generatedSummary,
        sessionCount: notes.length
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    )
  } catch (error) {
    console.error('Error in generate-ai-summary function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate AI summary',
        details: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    )
  }
})
