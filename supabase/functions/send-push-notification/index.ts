import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Send push notification function loaded")

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

interface SendNotificationRequest {
  userIds: string[];
  notification: NotificationPayload;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient, user } = await createAuthenticatedClient(req)

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
      const { userIds, notification }: SendNotificationRequest = await req.json()

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid userIds' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (!notification || !notification.title || !notification.body) {
        return new Response(
          JSON.stringify({ error: 'Invalid notification payload' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const results = await sendPushNotifications(supabaseClient, userIds, notification)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          results,
          sent: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in send-push-notification:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function createAuthenticatedClient(req: Request) {
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

async function sendPushNotifications(
  supabaseClient: any, 
  userIds: string[], 
  notification: NotificationPayload
) {
  const results = []

  // Get active subscriptions for all users
  const { data: subscriptions, error: fetchError } = await supabaseClient
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)
    .eq('is_active', true)

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError)
    return userIds.map(userId => ({
      userId,
      success: false,
      error: 'Failed to fetch subscription'
    }))
  }

  // Send notifications to each subscription
  for (const subscription of subscriptions || []) {
    try {
      const result = await sendToSubscription(subscription, notification)
      results.push({
        userId: subscription.user_id,
        success: result.success,
        error: result.error
      })

      // If subscription is invalid, mark it as inactive
      if (!result.success && result.shouldDeactivate) {
        await supabaseClient
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', subscription.id)
      }

    } catch (error) {
      console.error(`Error sending to subscription ${subscription.id}:`, error)
      results.push({
        userId: subscription.user_id,
        success: false,
        error: error.message
      })
    }
  }

  // Add results for users with no active subscriptions
  const processedUserIds = new Set(results.map(r => r.userId))
  for (const userId of userIds) {
    if (!processedUserIds.has(userId)) {
      results.push({
        userId,
        success: false,
        error: 'No active subscription found'
      })
    }
  }

  return results
}

async function sendToSubscription(subscription: any, notification: NotificationPayload) {
  console.log('Attempting to send notification to subscription:', {
    endpoint: subscription.endpoint,
    hasKeys: !!(subscription.p256dh && subscription.auth)
  })

  try {
    // Use Node.js web-push via NPM CDN with Deno compatibility
    const webPush = await import('npm:web-push@3.6.7')
    
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')
    const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY')

    if (!vapidPrivateKey || !vapidSubject || !vapidPublicKey) {
      console.error('VAPID keys not configured')
      return {
        success: false,
        error: 'VAPID keys not configured',
        shouldDeactivate: false
      }
    }

    // Set VAPID details
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // Prepare the notification payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/android-chrome-192x192.png',
      badge: notification.badge || '/favicon-32x32.png',
      tag: notification.tag || 'default',
      data: notification.data || {},
      actions: notification.actions || []
    })

    console.log('Sending notification with payload:', payload)

    // Reconstruct the subscription object
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    }

    // Send the notification
    const response = await webPush.sendNotification(pushSubscription, payload)
    
    console.log('Push notification sent successfully:', response)

    return {
      success: true,
      error: null,
      shouldDeactivate: false
    }

  } catch (error) {
    console.error('Error sending push notification:', error)
    
    // Check if it's a subscription error that should deactivate the subscription
    const shouldDeactivate = error.statusCode === 410 || // Gone
                             error.statusCode === 404 || // Not Found
                             (error.statusCode === 400 && error.body?.includes('invalid'))

    return {
      success: false,
      error: error.message,
      shouldDeactivate
    }
  }
}