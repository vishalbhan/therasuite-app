import type { NotificationTemplate, PushNotificationPayload } from '@/types/notifications';
import type { Appointment } from '@/types/supabase';

export function createAppointmentReminderNotification(
  appointment: Appointment,
  decryptedClientName?: string
): NotificationTemplate {
  const clientName = decryptedClientName || 'Client';
  const appointmentTime = new Date(appointment.session_date);
  const timeString = appointmentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return {
    title: 'Upcoming Appointment Reminder',
    body: `You have an appointment with ${clientName} at ${timeString}`,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    data: {
      appointmentId: appointment.id,
      clientName,
      appointmentTime: appointment.session_date,
      action: 'appointment_reminder'
    },
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/favicon-16x16.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon-16x16.png'
      }
    ]
  };
}

export function createAppointmentCancelledNotification(
  appointment: Appointment,
  decryptedClientName?: string
): NotificationTemplate {
  const clientName = decryptedClientName || 'Client';
  
  return {
    title: 'Appointment Cancelled',
    body: `Your appointment with ${clientName} has been cancelled`,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    data: {
      appointmentId: appointment.id,
      clientName,
      appointmentTime: appointment.session_date,
      action: 'appointment_cancelled'
    },
    actions: [
      {
        action: 'view',
        title: 'View Calendar',
        icon: '/favicon-16x16.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon-16x16.png'
      }
    ]
  };
}

export function createAppointmentUpdatedNotification(
  appointment: Appointment,
  decryptedClientName?: string
): NotificationTemplate {
  const clientName = decryptedClientName || 'Client';
  const appointmentTime = new Date(appointment.session_date);
  const timeString = appointmentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return {
    title: 'Appointment Updated',
    body: `Your appointment with ${clientName} has been rescheduled to ${timeString}`,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    data: {
      appointmentId: appointment.id,
      clientName,
      appointmentTime: appointment.session_date,
      action: 'appointment_updated'
    },
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/favicon-16x16.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon-16x16.png'
      }
    ]
  };
}

export function formatNotificationTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatNotificationDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
}

export function isNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  return await Notification.requestPermission();
}

export function showLocalNotification(
  title: string,
  options: NotificationOptions = {}
): Notification | null {
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted') {
    return null;
  }

  return new Notification(title, {
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    ...options
  });
}

// Helper to calculate reminder time
export function calculateReminderTime(appointmentTime: Date, minutesBefore: number): Date {
  return new Date(appointmentTime.getTime() - (minutesBefore * 60 * 1000));
}

// Helper to check if reminder time has passed
export function hasReminderTimePassed(reminderTime: Date): boolean {
  return reminderTime <= new Date();
}

// Helper to format reminder timing options
export const REMINDER_TIME_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 20, label: '20 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' }
] as const;