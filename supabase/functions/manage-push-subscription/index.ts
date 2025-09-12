import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Push subscription management function loaded")

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient, user } = await createClient(req)

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (req.method === 'POST') {
      const { subscription, action } = await req.json()

      if (action === 'subscribe') {
        return await handleSubscribe(supabaseClient, user.id, subscription)
      } else if (action === 'unsubscribe') {
        return await handleUnsubscribe(supabaseClient, user.id)
      }
    }

    if (req.method === 'GET') {
      return await handleGetSubscription(supabaseClient, user.id)
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in manage-push-subscription:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function createClient(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('No authorization header')
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseClient.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid token')
  }

  return { supabaseClient, user }
}

async function handleSubscribe(supabaseClient: any, userId: string, subscription: PushSubscriptionData) {
  try {
    // Validate subscription data
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription data' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const subscriptionData = {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      is_active: true
    }

    // Upsert subscription (replace existing if any)
    const { data, error } = await supabaseClient
      .from('push_subscriptions')
      .upsert(subscriptionData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to save subscription' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, subscription: data }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error handling subscribe:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to subscribe' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

async function handleUnsubscribe(supabaseClient: any, userId: string) {
  try {
    const { error } = await supabaseClient
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to unsubscribe' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error handling unsubscribe:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to unsubscribe' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

async function handleGetSubscription(supabaseClient: any, userId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to get subscription' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ subscription: data }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error handling get subscription:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get subscription' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}