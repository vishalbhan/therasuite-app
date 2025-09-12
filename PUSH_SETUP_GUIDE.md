# Push Notifications Setup Guide

This guide will help you complete the setup of push notifications for your TheraSuite PWA.

## 1. Generate VAPID Keys

First, you need to generate VAPID keys for your application. Run this command in your project directory:

```bash
npx web-push generate-vapid-keys
```

This will output something like:
```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib-q6ODSLxcPrEAFNUvUhKnRDWPJcuZAn2VUo-Rmt9TdKE-v4w...

Private Key:
-9jgrhZJhxfGjLN2-nZKUo2tFQvvBKFpYMRx7K3pJq45dR-9PmFNKYHBfhFvhyOqbxOBn2DGhLU...

=======================================
```

## 2. Update Environment Variables

Add these environment variables to your `.env` file:

```bash
# Push Notification VAPID Keys
VITE_VAPID_PUBLIC_KEY=your_public_vapid_key_here
VAPID_PRIVATE_KEY=your_private_vapid_key_here
VAPID_SUBJECT=mailto:your-email@domain.com

# Existing Supabase variables (already configured)
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important:** Replace:
- `your_public_vapid_key_here` with the Public Key from step 1
- `your_private_vapid_key_here` with the Private Key from step 1
- `your-email@domain.com` with your actual email address

## 3. Run Database Migrations

Apply the database schema changes by running the migration:

```bash
# If using Supabase CLI
supabase db reset

# Or apply the migration manually in your Supabase dashboard
# Copy and paste the content of supabase/migrations/001_add_push_subscriptions.sql
```

## 4. Deploy Edge Functions

Deploy the push notification Edge Functions to Supabase:

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy manage-push-subscription
supabase functions deploy send-push-notification
supabase functions deploy schedule-appointment-reminders
```

## 5. Set Environment Variables in Supabase

In your Supabase project dashboard, go to Settings > Edge Functions and add these environment variables:

```bash
VAPID_PRIVATE_KEY=your_private_vapid_key_here
VAPID_SUBJECT=mailto:your-email@domain.com
VITE_VAPID_PUBLIC_KEY=your_public_vapid_key_here
```

## 6. Test the Implementation

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to your app and look for the notification permission prompt or settings

3. Enable notifications and test the functionality

## 7. Integration Points

### Adding Notification Settings to Your App

Import and use the notification components in your settings or preferences page:

```tsx
import { PushNotificationSettings } from '@/components/notifications/PushNotificationSettings';
import { NotificationPermissionPrompt } from '@/components/notifications/NotificationPermissionPrompt';

// In your settings component
<PushNotificationSettings />

// In your main app layout (show once)
<NotificationPermissionPrompt 
  onGranted={() => console.log('Notifications granted!')}
  onDismiss={() => console.log('User dismissed prompt')}
/>
```

### Using the Notification Hooks

```tsx
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

function MyComponent() {
  const { isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const { preferences, updatePreferences } = useNotificationPreferences();

  // Your component logic here
}
```

## 8. Set Up Appointment Reminder Cron Job

To automatically send appointment reminders, you need to set up a cron job that calls the scheduler function. In your Supabase project dashboard:

1. Go to Database > Extensions and enable `pg_cron`
2. Run this SQL to schedule the reminder job:

```sql
SELECT cron.schedule('appointment-reminders', '*/5 * * * *', 'SELECT http_post(
  ''https://your-project-ref.supabase.co/functions/v1/schedule-appointment-reminders'',
  ''{"scheduled": true}'',
  ''application/json''
);');
```

Replace `your-project-ref` with your actual Supabase project reference.

## 9. Production Deployment

When deploying to production:

1. Ensure all environment variables are set in your hosting platform
2. Make sure your domain is HTTPS (required for push notifications)
3. Test notifications on different browsers and devices
4. Monitor the notification_queue table for any delivery issues

## 10. Browser Compatibility

Push notifications work on:
- ✅ Chrome 50+
- ✅ Firefox 44+
- ✅ Safari 16+
- ✅ Edge 17+
- ❌ iOS Safari (limited support, requires user gesture)

## Troubleshooting

### Common Issues:

1. **"VAPID keys not configured" error**
   - Check that environment variables are properly set
   - Restart your development server after adding env vars

2. **Service Worker registration fails**
   - Check browser console for errors
   - Ensure you're using HTTPS in production

3. **Notifications not appearing**
   - Check notification permissions in browser settings
   - Verify the service worker is registered and active
   - Check browser console for errors

4. **Database permission errors**
   - Ensure RLS policies are properly applied
   - Check that user authentication is working

### Debug Tools:

- Browser DevTools > Application > Service Workers
- Browser DevTools > Application > Push Messaging
- Supabase Dashboard > Logs for Edge Function errors

## Next Steps

After completing the setup:

1. Test notifications thoroughly across different browsers
2. Monitor notification delivery rates
3. Gather user feedback on notification timing and content
4. Consider adding more notification types (appointment updates, cancellations, etc.)

The implementation follows the comprehensive plan in `PUSH_NOTIFICATIONS.md` and provides a solid foundation for push notifications in your TheraSuite PWA.