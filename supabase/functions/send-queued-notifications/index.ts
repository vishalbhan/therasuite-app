import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Send queued notifications function loaded")

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // This function is typically called by a cron job
    if (req.method === 'POST') {
      const results = await sendQueuedNotifications(supabaseClient)
      
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
    console.error('Error in send-queued-notifications:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function sendQueuedNotifications(supabaseClient: any) {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: []
  }

  try {
    // Get pending notifications that are due to be sent
    const { data: notifications, error: notificationsError } = await supabaseClient
      .from('notification_queue')
      .select(`
        id,
        user_id,
        appointment_id,
        notification_type,
        scheduled_for,
        appointments!inner(
          id,
          client_name,
          session_date,
          session_length,
          session_type
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError)
      results.errors.push(`Failed to fetch notifications: ${notificationsError.message}`)
      return results
    }

    console.log(`Found ${notifications?.length || 0} notifications to send`)

    for (const notification of notifications || []) {
      try {
        results.processed++

        if (notification.notification_type === 'appointment_reminder') {
          await sendAppointmentReminder(supabaseClient, notification)
          results.sent++
          
          // Mark notification as sent
          await supabaseClient
            .from('notification_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', notification.id)

          console.log(`Sent reminder for appointment ${notification.appointment_id}`)
        }

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error)
        results.failed++
        results.errors.push(`Failed to send notification ${notification.id}: ${error.message}`)
        
        // Mark notification as failed
        await supabaseClient
          .from('notification_queue')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            retry_count: notification.retry_count + 1
          })
          .eq('id', notification.id)
      }
    }

  } catch (error) {
    console.error('Error in sendQueuedNotifications:', error)
    results.errors.push(`General error: ${error.message}`)
  }

  return results
}

// Direct decryption functions (same logic as encrypt-client-data function)
async function getEncryptionKey(): Promise<CryptoKey> {
  const encryptionKeyHex = Deno.env.get('ENCRYPTION_KEY')
  if (!encryptionKeyHex) {
    throw new Error('ENCRYPTION_KEY environment variable not set')
  }
  
  // Convert hex string to ArrayBuffer
  const keyData = new Uint8Array(encryptionKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  
  // Import the key for AES-GCM
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
}

async function decryptData(encryptedText: string, key: CryptoKey): Promise<string> {
  // Check if data is encrypted (has our prefix)
  if (!encryptedText.startsWith('enc:')) {
    return encryptedText // Return original if not encrypted
  }
  
  try {
    // Remove prefix and decode base64
    const base64Data = encryptedText.substring(4)
    const combined = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encrypted
    )
    
    // Convert back to string
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    // Return original text if decryption fails (fallback for corrupted data)
    return encryptedText
  }
}

async function decryptClientName(encryptedName: string): Promise<string> {
  // If the name doesn't start with 'enc:', it's not encrypted
  if (!encryptedName.startsWith('enc:')) {
    return encryptedName
  }

  try {
    const key = await getEncryptionKey()
    const decryptedName = await decryptData(encryptedName, key)
    return decryptedName
  } catch (error) {
    console.error('Error decrypting client name:', error)
    return encryptedName // Fallback to encrypted name
  }
}

async function sendAppointmentReminder(supabaseClient: any, notification: any) {
  const appointment = notification.appointments
  
  // Decrypt the client name
  const decryptedClientName = await decryptClientName(appointment.client_name)
  
  // Format the appointment time in Indian Standard Time
  const appointmentDate = new Date(appointment.session_date)
  const timeString = appointmentDate.toLocaleTimeString('en-IN', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  })

  // Create notification payload
  const notificationPayload = {
    title: "Upcoming Appointment",
    body: `You have an appointment with ${decryptedClientName} at ${timeString} today`,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'appointment_reminder',
    data: {
      type: 'appointment_reminder',
      appointment_id: appointment.id,
      appointment_date: appointment.session_date,
      client_name: decryptedClientName
    }
  }

  // Send push notifications directly
  await sendPushNotificationDirect(supabaseClient, [notification.user_id], notificationPayload)
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