import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface SendRequest {
  userIds: string[];
  notification: NotificationPayload;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { userIds, notification }: SendRequest = await req.json();

    if (!userIds?.length || !notification?.title || !notification?.body) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch active Expo push tokens for the given users
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint')
      .in('user_id', userIds)
      .eq('is_active', true)
      .like('endpoint', 'ExponentPushToken%');

    if (fetchError) throw fetchError;
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No Expo tokens found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Expo push messages
    const messages = subscriptions.map((sub) => ({
      to: sub.endpoint,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
      sound: 'default',
      priority: 'high',
    }));

    // Send to Expo Push API in batches of 100
    const BATCH_SIZE = 100;
    const results = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const json = await res.json();
      results.push(...(json.data ?? [json]));
    }

    // Deactivate any tokens that Expo reports as invalid
    const invalidTokens = subscriptions
      .filter((_, idx) => results[idx]?.status === 'error' &&
        (results[idx]?.details?.error === 'DeviceNotRegistered' ||
         results[idx]?.details?.error === 'InvalidCredentials'))
      .map((s) => s.endpoint);

    if (invalidTokens.length) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('endpoint', invalidTokens);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.filter((r) => r.status === 'ok').length,
        failed: results.filter((r) => r.status !== 'ok').length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('send-expo-push error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
