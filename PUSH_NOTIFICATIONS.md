# Push Notifications Implementation Plan for TheraSuite PWA

## Overview
This document outlines the step-by-step implementation of push notifications for the TheraSuite PWA, with the primary use case of notifying therapists 15 minutes before appointments.

## Current PWA Setup Analysis
- **Framework**: Vite + React with TypeScript
- **PWA Plugin**: `vite-plugin-pwa` (v1.0.3) with Workbox
- **Backend**: Supabase with Edge Functions
- **Service Worker**: Auto-generated with Workbox
- **Current Features**: Offline support, caching, PWA manifest

## Architecture Overview

### Components Required
1. **Frontend Push Subscription Management**
2. **Backend Push Notification Service**
3. **Scheduling System for Appointment Reminders**
4. **Service Worker Push Event Handling**
5. **User Permission Management**

## Step-by-Step Implementation Plan

### Phase 1: Frontend Push Notification Foundation

#### Step 1: Install Required Dependencies
```bash
npm install web-push @types/web-push
```

#### Step 2: Update Service Worker Configuration
- Modify `vite.config.ts` to include custom service worker handling
- Add push notification event handlers to the service worker
- Update Workbox configuration to support push notifications

#### Step 3: Create Push Notification Hook
Create `src/hooks/usePushNotifications.ts`:
- Request notification permissions
- Subscribe/unsubscribe from push notifications
- Handle subscription updates
- Store subscription data in Supabase

#### Step 4: Create Push Notification Settings Component
Create `src/components/notifications/PushNotificationSettings.tsx`:
- Toggle for enabling/disabling push notifications
- Appointment reminder time settings (default: 15 minutes)
- Permission status display
- Test notification functionality

### Phase 2: Backend Infrastructure

#### Step 5: Create Supabase Database Schema
Create migration for push notification storage:
```sql
-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create notification_preferences table
CREATE TABLE notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_reminder_enabled BOOLEAN DEFAULT TRUE,
  reminder_minutes_before INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
```

#### Step 6: Create Push Notification Edge Function
Create `supabase/functions/send-push-notification/index.ts`:
- Handle VAPID key generation and management
- Send push notifications to subscribed users
- Batch notification sending for multiple users
- Error handling and retry logic
- Notification delivery status tracking

#### Step 7: Create Subscription Management Edge Function
Create `supabase/functions/manage-push-subscription/index.ts`:
- Store/update push subscriptions
- Remove inactive subscriptions
- Validate subscription data
- Handle subscription renewals

### Phase 3: Appointment Reminder System

#### Step 8: Create Appointment Reminder Scheduler
Create `supabase/functions/schedule-appointment-reminders/index.ts`:
- Query appointments scheduled for the next hour
- Check user notification preferences
- Calculate reminder timing based on user settings
- Queue reminder notifications
- Handle timezone considerations

#### Step 9: Implement Cron Job for Reminder Processing
- Set up Supabase Edge Function cron job (runs every 5 minutes)
- Process queued appointment reminders
- Send push notifications to relevant therapists
- Update reminder status in database
- Handle failed notification attempts

#### Step 10: Create Notification Queue System
Create database schema for notification queue:
```sql
-- Create notification_queue table
CREATE TABLE notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, cancelled
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
```

### Phase 4: Service Worker Enhancement

#### Step 11: Custom Service Worker Implementation
Create `public/sw.js` (or enhance existing):
```javascript
// Handle push notification events
self.addEventListener('push', (event) => {
  // Parse notification data
  // Display notification with appointment details
  // Handle notification click actions
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  // Close notification
  // Open app to specific appointment or dashboard
  // Focus existing window if already open
});

// Handle background sync for failed notifications
self.addEventListener('sync', (event) => {
  // Retry failed notification subscriptions
  // Sync notification preferences
});
```

#### Step 12: Update Vite PWA Configuration
Modify `vite.config.ts`:
```typescript
VitePWA({
  // ... existing config
  strategies: 'injectManifest',
  srcDir: 'public',
  filename: 'sw.js',
  workbox: {
    // ... existing workbox config
    additionalManifestEntries: [
      // Add any additional resources needed for notifications
    ]
  }
})
```

### Phase 5: User Interface Integration

#### Step 13: Update Settings/Preferences Page
- Add push notification settings section
- Integrate notification preference controls
- Add test notification button
- Show subscription status and troubleshooting info

#### Step 14: Add Notification Permission Prompt
Create `src/components/notifications/NotificationPermissionPrompt.tsx`:
- Show when user first accesses appointment features
- Explain benefits of push notifications
- Handle permission denial gracefully
- Provide re-permission request mechanism

#### Step 15: Update Dashboard with Notification Status
- Show notification subscription status
- Display recent notification history
- Add quick settings access
- Show upcoming appointment reminders

### Phase 6: Advanced Features

#### Step 16: Notification Templates and Customization
Create flexible notification templates:
```typescript
interface NotificationTemplate {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: {
    appointmentId: string;
    clientName: string;
    appointmentTime: string;
    action: 'appointment_reminder' | 'appointment_cancelled' | 'appointment_updated';
  };
  actions?: NotificationAction[];
}
```

#### Step 17: Implement Notification Actions
Add action buttons to notifications:
- "View Appointment" - Opens appointment details
- "Mark as Reviewed" - Acknowledges the reminder
- "Reschedule" - Opens reschedule modal
- "Cancel" - Cancels the appointment (with confirmation)

#### Step 18: Add Rich Notifications
Enhance notifications with:
- Client photos (if available)
- Appointment type icons
- Duration and location information
- Previous session notes preview

### Phase 7: Testing and Optimization

#### Step 19: Implement Comprehensive Testing
- Unit tests for push notification hooks
- Integration tests for subscription management
- End-to-end tests for notification flow
- Test notification delivery across different devices/browsers
- Test offline notification queuing and sync

#### Step 20: Performance Optimization
- Implement efficient subscription management
- Optimize notification payload size
- Add notification batching for multiple appointments
- Implement smart retry logic for failed deliveries
- Cache VAPID keys and subscription data

#### Step 21: Error Handling and Monitoring
- Add comprehensive error logging
- Implement notification delivery tracking
- Create admin dashboard for notification metrics
- Add user-facing notification troubleshooting
- Monitor subscription renewal rates

### Phase 8: Security and Privacy

#### Step 22: Implement Security Best Practices
- Secure VAPID key storage
- Validate all notification payloads
- Implement rate limiting for notification sending
- Add subscription verification
- Secure Edge Function endpoints

#### Step 23: Privacy Compliance
- Add notification data retention policies
- Implement user data deletion for GDPR compliance
- Add clear privacy notices for push notifications
- Allow users to export their notification data
- Provide granular notification control

## Environment Variables Required

```bash
# VAPID Keys (generate using web-push library)
VITE_VAPID_PUBLIC_KEY=your_public_vapid_key
VAPID_PRIVATE_KEY=your_private_vapid_key
VAPID_SUBJECT=mailto:your-email@domain.com

# Supabase (existing)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## File Structure

```
src/
├── hooks/
│   ├── usePushNotifications.ts
│   └── useNotificationPreferences.ts
├── components/
│   └── notifications/
│       ├── PushNotificationSettings.tsx
│       ├── NotificationPermissionPrompt.tsx
│       └── NotificationHistory.tsx
├── types/
│   └── notifications.ts
└── utils/
    └── notifications.ts

supabase/
├── functions/
│   ├── send-push-notification/
│   ├── manage-push-subscription/
│   ├── schedule-appointment-reminders/
│   └── process-notification-queue/
└── migrations/
    ├── add_push_subscriptions_table.sql
    ├── add_notification_preferences_table.sql
    └── add_notification_queue_table.sql

public/
└── sw.js (custom service worker)
```

## Browser Compatibility

### Supported Browsers:
- Chrome 50+ (full support)
- Firefox 44+ (full support)
- Safari 16+ (limited support - iOS Safari has restrictions)
- Edge 17+ (full support)

### Known Limitations:
- iOS Safari requires user gesture for subscription
- Some browsers may have notification limits
- Background sync support varies by browser

## Testing Strategy

1. **Development Testing**:
   - Test on localhost with HTTPS (required for push notifications)
   - Use browser dev tools to simulate push notifications
   - Test permission flows in different scenarios

2. **Staging Testing**:
   - Test on deployed staging environment
   - Verify VAPID keys and service worker registration
   - Test notification delivery timing

3. **Production Testing**:
   - Monitor notification delivery rates
   - Track user engagement with notifications
   - Monitor error rates and failed deliveries

## Rollout Plan

1. **Phase 1**: Internal testing with team accounts
2. **Phase 2**: Beta testing with select therapists
3. **Phase 3**: Gradual rollout to all users with opt-in
4. **Phase 4**: Full deployment with proactive prompting

## Success Metrics

- Notification subscription rate
- Notification delivery success rate
- User engagement with notifications
- Appointment no-show reduction
- User satisfaction with reminder timing

## Maintenance and Updates

- Monitor subscription renewals and handle expiries
- Update VAPID keys as needed
- Keep service worker updated with new features
- Regular cleanup of inactive subscriptions
- Monitor and respond to browser API changes

## Troubleshooting Common Issues

1. **Service Worker Registration Failures**
2. **VAPID Key Mismatches**
3. **Permission Denied Scenarios**
4. **Notification Not Displaying**
5. **Background Sync Issues**
6. **Cross-Device Subscription Management**

---

This implementation plan provides a comprehensive approach to adding push notifications to your TheraSuite PWA, focusing on the appointment reminder use case while building a flexible foundation for future notification features.