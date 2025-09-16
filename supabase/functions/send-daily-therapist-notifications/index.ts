import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Send daily therapist notifications function loaded")

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization for scheduled calls
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    // Allow calls with proper cron secret or service role JWT
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)

        // Check if it's a valid cron secret
        if (cronSecret && token === cronSecret) {
          // Valid cron secret, proceed
        } else {
          // Validate JWT structure and check if it's a service role token
          try {
            const parts = token.split('.')
            if (parts.length !== 3) {
              throw new Error('Invalid JWT format')
            }

            // Decode the payload (without verification for role check)
            const payload = JSON.parse(atob(parts[1]))

            // Check if it's a service role token
            if (payload.role !== 'service_role') {
              return new Response(
                JSON.stringify({ error: 'Unauthorized - Invalid role' }),
                {
                  status: 401,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              )
            }

            // Additional check: ensure it's from the correct Supabase instance
            if (payload.ref !== 'nkobjmahyfkkbxeqafww') {
              return new Response(
                JSON.stringify({ error: 'Unauthorized - Invalid project' }),
                {
                  status: 401,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              )
            }

          } catch (error) {
            return new Response(
              JSON.stringify({ error: 'Unauthorized - Invalid token' }),
              {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid authorization format' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
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

    // This function is typically called by a cron job at 8 AM IST
    if (req.method === 'POST') {
      const results = await sendDailyTherapistNotifications(supabaseClient)

      return new Response(
        JSON.stringify({
          success: true,
          processed: results.processed,
          sent: results.sent,
          failed: results.failed,
          errors: results.errors
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
    console.error('Error in send-daily-therapist-notifications:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function sendDailyTherapistNotifications(supabaseClient: any) {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: []
  }

  try {
    // Get the current date in IST (Indian Standard Time)
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000 // IST is UTC+5:30
    const istDate = new Date(now.getTime() + istOffset)

    // Get start and end of today in IST
    const startOfDay = new Date(istDate)
    startOfDay.setUTCHours(0, 0, 0, 0)

    const endOfDay = new Date(istDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Convert back to UTC for database query
    const startOfDayUTC = new Date(startOfDay.getTime() - istOffset)
    const endOfDayUTC = new Date(endOfDay.getTime() - istOffset)

    console.log(`Checking appointments for today: ${startOfDayUTC.toISOString()} to ${endOfDayUTC.toISOString()}`)

    // Get all therapists who have appointments today and have daily notifications enabled
    const { data: therapistsWithAppointments, error: therapistsError } = await supabaseClient
      .from('appointments')
      .select(`
        id,
        therapist_id,
        session_date
      `)
      .eq('status', 'scheduled')
      .gte('session_date', startOfDayUTC.toISOString())
      .lte('session_date', endOfDayUTC.toISOString())

    if (therapistsError) {
      console.error('Error fetching therapists with appointments:', therapistsError)
      results.errors.push(`Failed to fetch therapists: ${therapistsError.message}`)
      return results
    }

    // Group appointments by therapist
    const therapistAppointments = new Map()

    for (const appointment of therapistsWithAppointments || []) {
      const therapistId = appointment.therapist_id
      if (!therapistAppointments.has(therapistId)) {
        therapistAppointments.set(therapistId, {
          therapist: null, // Will fetch separately
          appointments: []
        })
      }
      therapistAppointments.get(therapistId).appointments.push(appointment)
    }

    // Fetch therapist profiles for all unique therapist IDs
    const therapistIds = Array.from(therapistAppointments.keys())
    if (therapistIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .in('id', therapistIds)

      if (profilesError) {
        console.error('Error fetching therapist profiles:', profilesError)
        results.errors.push(`Failed to fetch therapist profiles: ${profilesError.message}`)
        return results
      }

      // Update therapist data with profiles
      profiles?.forEach(profile => {
        if (therapistAppointments.has(profile.id)) {
          therapistAppointments.get(profile.id).therapist = profile
        }
      })
    }

    console.log(`Found ${therapistAppointments.size} therapists with appointments today`)

    // Process each therapist
    for (const [therapistId, data] of therapistAppointments) {
      try {
        results.processed++

        // Check if therapist has daily notifications enabled
        const { data: preferences, error: preferencesError } = await supabaseClient
          .from('notification_preferences')
          .select('daily_reminder_enabled')
          .eq('user_id', therapistId)
          .maybeSingle()

        if (preferencesError) {
          console.error(`Error fetching preferences for therapist ${therapistId}:`, preferencesError)
          results.failed++
          results.errors.push(`Failed to fetch preferences for therapist ${therapistId}`)
          continue
        }

        // Skip if daily notifications are disabled
        if (preferences && preferences.daily_reminder_enabled === false) {
          console.log(`Daily notifications disabled for therapist ${therapistId}`)
          continue
        }

        // Check if therapist has active push subscriptions
        const { data: subscriptions, error: subscriptionsError } = await supabaseClient
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', therapistId)
          .eq('is_active', true)

        if (subscriptionsError) {
          console.error(`Error fetching subscriptions for therapist ${therapistId}:`, subscriptionsError)
          results.failed++
          results.errors.push(`Failed to fetch subscriptions for therapist ${therapistId}`)
          continue
        }

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`No active subscriptions for therapist ${therapistId}`)
          continue
        }

        await sendDailyNotificationToTherapist(supabaseClient, data.therapist, data.appointments.length)
        results.sent++

        console.log(`Sent daily notification to therapist ${therapistId} (${data.therapist.full_name})`)

      } catch (error) {
        console.error(`Error processing therapist ${therapistId}:`, error)
        results.failed++
        results.errors.push(`Failed to process therapist ${therapistId}: ${error.message}`)
      }
    }

  } catch (error) {
    console.error('Error in sendDailyTherapistNotifications:', error)
    results.errors.push(`General error: ${error.message}`)
  }

  return results
}

async function sendDailyNotificationToTherapist(supabaseClient: any, therapist: any, appointmentCount: number) {
  const firstName = therapist.full_name ? therapist.full_name.split(' ')[0] : 'there'
  const appointmentText = appointmentCount === 1 ? 'appointment' : 'appointments'

  // Create notification payload
  const notificationPayload = {
    title: "Good Morning! 🌅",
    body: `Good Morning ${firstName}, You have ${appointmentCount} ${appointmentText} scheduled for today`,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'daily_reminder',
    data: {
      type: 'daily_reminder',
      appointment_count: appointmentCount,
      date: new Date().toISOString()
    },
    actions: [
      {
        action: 'view_schedule',
        title: 'View Schedule',
        icon: '/favicon-16x16.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon-16x16.png'
      }
    ]
  }

  // Send push notification directly
  await sendPushNotificationDirect(supabaseClient, [therapist.id], notificationPayload)
}

async function sendPushNotificationDirect(supabaseClient: any, userIds: string[], notification: any) {
  // Get active subscriptions for the users
  const { data: subscriptions, error: fetchError } = await supabaseClient
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)
    .eq('is_active', true)

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError)
    throw new Error('Failed to fetch push subscriptions')
  }

  if (!subscriptions || subscriptions.length === 0) {
    return
  }

  // Send notifications to each subscription
  for (const subscription of subscriptions) {
    try {
      await sendToSubscription(subscription, notification, supabaseClient)
    } catch (error) {
      console.error(`Error sending to subscription ${subscription.id}:`, error)

      // If subscription is invalid, mark it as inactive
      if (error.statusCode === 410 || error.statusCode === 404) {
        await supabaseClient
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', subscription.id)
      }
    }
  }
}

async function sendToSubscription(subscription: any, notification: any, supabaseClient: any) {
  try {
    // Use web-push
    const webPush = await import('npm:web-push@3.6.7')

    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')
    const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY')

    if (!vapidPrivateKey || !vapidSubject || !vapidPublicKey) {
      throw new Error('VAPID keys not configured')
    }

    // Set VAPID details
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // Prepare the notification payload
    const payload = JSON.stringify(notification)

    // Reconstruct the subscription object
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    }

    // Send the notification
    await webPush.sendNotification(pushSubscription, payload)

  } catch (error) {
    console.error('Error sending push notification:', error)
    throw error
  }
}