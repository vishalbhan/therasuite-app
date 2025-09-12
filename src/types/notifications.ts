export interface PushSubscriptionData {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  appointment_reminder_enabled: boolean;
  reminder_minutes_before: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  title: string;
  body: string;
  icon: string;
  badge?: string;
  data: {
    appointmentId: string;
    clientName: string;
    appointmentTime: string;
    action: 'appointment_reminder' | 'appointment_cancelled' | 'appointment_updated';
  };
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationQueue {
  id: string;
  user_id: string;
  appointment_id: string;
  notification_type: string;
  scheduled_for: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retry_count: number;
  error_message?: string;
  created_at: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
}

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface PushNotificationState {
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
}