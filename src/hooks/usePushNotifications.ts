import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PushNotificationState, NotificationPermission, PushSubscriptionData } from '@/types/notifications';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    subscription: null,
    isSupported: false,
    isSubscribed: false,
    isLoading: true
  });

  const [error, setError] = useState<string | null>(null);

  const checkSupport = useCallback(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    return isSupported;
  }, []);

  const getCurrentPermission = useCallback((): NotificationPermission => {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission as NotificationPermission;
  }, []);

  const getServiceWorkerRegistration = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) return null;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      return registration;
    } catch (err) {
      console.error('Service Worker registration failed:', err);
      return null;
    }
  }, []);

  const getCurrentSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    const registration = await getServiceWorkerRegistration();
    if (!registration) return null;

    try {
      return await registration.pushManager.getSubscription();
    } catch (err) {
      console.error('Failed to get push subscription:', err);
      return null;
    }
  }, [getServiceWorkerRegistration]);

  const savePushSubscription = useCallback(async (subscription: PushSubscription): Promise<void> => {
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      throw new Error('User not authenticated');
    }

    const subscriptionData = {
      user_id: user.data.user.id,
      endpoint: subscription.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
      is_active: true
    };

    // Use RPC call or direct SQL to handle upsert
    const { error } = await supabase.rpc('upsert_push_subscription', subscriptionData);

    if (error) {
      console.error('Failed to save push subscription:', error);
      // Fallback: try insert first, then update if it fails
      const { error: insertError } = await supabase
        .from('push_subscriptions' as any)
        .insert(subscriptionData);
      
      if (insertError) {
        const { error: updateError } = await supabase
          .from('push_subscriptions' as any)
          .update(subscriptionData)
          .eq('user_id', user.data.user.id);
        
        if (updateError) {
          throw new Error('Failed to save push subscription');
        }
      }
    }
  }, []);

  const removePushSubscription = useCallback(async (): Promise<void> => {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    const { error } = await supabase
      .from('push_subscriptions' as any)
      .update({ is_active: false })
      .eq('user_id', user.data.user.id);

    if (error) {
      console.error('Failed to remove push subscription:', error);
      throw new Error('Failed to remove push subscription');
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    const permission = await Notification.requestPermission();
    setState(prev => ({ ...prev, permission: permission as NotificationPermission }));
    return permission as NotificationPermission;
  }, []);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      setError(null);
      setState(prev => ({ ...prev, isLoading: true }));

      if (!VAPID_PUBLIC_KEY) {
        throw new Error('VAPID public key is not configured');
      }

      const permission = await requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const registration = await getServiceWorkerRegistration();
      if (!registration) {
        throw new Error('Service Worker not available');
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      await savePushSubscription(subscription);

      setState(prev => ({
        ...prev,
        subscription,
        isSubscribed: true,
        isLoading: false
      }));

      return subscription;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to push notifications';
      setError(errorMessage);
      setState(prev => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [requestPermission, getServiceWorkerRegistration, savePushSubscription]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setState(prev => ({ ...prev, isLoading: true }));

      const subscription = await getCurrentSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      await removePushSubscription();

      setState(prev => ({
        ...prev,
        subscription: null,
        isSubscribed: false,
        isLoading: false
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications';
      setError(errorMessage);
      setState(prev => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [getCurrentSubscription, removePushSubscription]);

  const testNotification = useCallback(async (): Promise<void> => {
    if (!state.isSubscribed || !state.subscription) {
      throw new Error('Not subscribed to push notifications');
    }

    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds: [user.data.user.id],
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification from TheraSuite!',
          icon: '/android-chrome-192x192.png',
          data: {
            action: 'test',
            url: '/'
          }
        }
      }
    });

    if (error) {
      console.error('Failed to send test notification:', error);
      throw new Error('Failed to send test notification');
    }
  }, [state.isSubscribed, state.subscription]);

  const initializeNotifications = useCallback(async (): Promise<void> => {
    try {
      const isSupported = checkSupport();
      const permission = getCurrentPermission();
      const currentSubscription = isSupported ? await getCurrentSubscription() : null;

      setState({
        permission,
        subscription: currentSubscription,
        isSupported,
        isSubscribed: !!currentSubscription,
        isLoading: false
      });
    } catch (err) {
      console.error('Failed to initialize notifications:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [checkSupport, getCurrentPermission, getCurrentSubscription]);

  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  return {
    ...state,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
    testNotification,
    clearError: () => setError(null)
  };
}