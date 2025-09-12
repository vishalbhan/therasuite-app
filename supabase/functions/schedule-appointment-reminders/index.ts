import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Schedule appointment reminders function loaded")

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // This function is typically called by a cron job
    if (req.method === 'POST') {
      const results = await scheduleReminders(supabaseClient)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: results.processed,
          scheduled: results.scheduled,
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
    console.error('Error in schedule-appointment-reminders:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function scheduleReminders(supabaseClient: any) {
  const results = {
    processed: 0,
    scheduled: 0,
    errors: []
  }

  try {
    // Get appointments scheduled for the next 2 hours that don't have reminders scheduled yet
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    
    const { data: appointments, error: appointmentsError } = await supabaseClient
      .from('appointments')
      .select(`
        id,
        therapist_id,
        client_name,
        session_date,
        session_length,
        session_type
      `)
      .eq('status', 'scheduled')
      .gte('session_date', new Date().toISOString())
      .lte('session_date', twoHoursFromNow)

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError)
      results.errors.push(`Failed to fetch appointments: ${appointmentsError.message}`)
      return results
    }

    console.log(`Found ${appointments?.length || 0} appointments to process`)

    for (const appointment of appointments || []) {
      try {
        results.processed++

        // Check if reminder is already scheduled
        const { data: existingReminder } = await supabaseClient
          .from('notification_queue')
          .select('id')
          .eq('appointment_id', appointment.id)
          .eq('notification_type', 'appointment_reminder')
          .eq('status', 'pending')
          .maybeSingle()

        if (existingReminder) {
          console.log(`Reminder already scheduled for appointment ${appointment.id}`)
          continue
        }

        // Get user's notification preferences
        const { data: preferences } = await supabaseClient
          .from('notification_preferences')
          .select('appointment_reminder_enabled, reminder_minutes_before')
          .eq('user_id', appointment.therapist_id)
          .maybeSingle()

        if (!preferences?.appointment_reminder_enabled) {
          console.log(`Notifications disabled for user ${appointment.therapist_id}`)
          continue
        }

        const reminderMinutes = preferences.reminder_minutes_before || 15
        const appointmentTime = new Date(appointment.session_date)
        const reminderTime = new Date(appointmentTime.getTime() - (reminderMinutes * 60 * 1000))

        // Only schedule if reminder time is in the future
        if (reminderTime <= new Date()) {
          console.log(`Reminder time has passed for appointment ${appointment.id}`)
          continue
        }

        // Schedule the reminder
        const { error: insertError } = await supabaseClient
          .from('notification_queue')
          .insert({
            user_id: appointment.therapist_id,
            appointment_id: appointment.id,
            notification_type: 'appointment_reminder',
            scheduled_for: reminderTime.toISOString(),
            status: 'pending'
          })

        if (insertError) {
          console.error(`Error scheduling reminder for appointment ${appointment.id}:`, insertError)
          results.errors.push(`Failed to schedule reminder for appointment ${appointment.id}: ${insertError.message}`)
        } else {
          results.scheduled++
          console.log(`Scheduled reminder for appointment ${appointment.id} at ${reminderTime.toISOString()}`)
        }

      } catch (error) {
        console.error(`Error processing appointment ${appointment.id}:`, error)
        results.errors.push(`Error processing appointment ${appointment.id}: ${error.message}`)
      }
    }

  } catch (error) {
    console.error('Error in scheduleReminders:', error)
    results.errors.push(`General error: ${error.message}`)
  }

  return results
}

// Helper function to create Supabase client
function createClient(supabaseUrl: string, supabaseKey: string) {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          gte: (column: string, value: any) => ({
            lte: (column: string, value: any) => 
              fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=gte.${value}&${column}=lte.${value}`, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                }
              }).then(res => res.json()).then(data => ({ data, error: null }))
          }),
          maybeSingle: () => 
            fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              }
            }).then(res => res.json()).then(data => ({ data: data?.[0] || null, error: null }))
        }),
        insert: (data: any) => 
          fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          }).then(res => ({ data: null, error: res.ok ? null : { message: 'Insert failed' } }))
      })
    })
  }
}