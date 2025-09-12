import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Precache and route setup
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Handle SPA routing
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler);
registerRoute(navigationRoute);

// API cache strategy
registerRoute(
  ({ url }) => url.origin === 'https://api.' || url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [{
      cacheKeyWillBeUsed: async ({ request }) => {
        return `${request.url}?${Date.now()}`;
      }
    }]
  })
);

// Push notification event handler
self.addEventListener('push', function(event) {
  console.log('Push event received:', event);

  const options = {
    body: 'You have an upcoming appointment',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'appointment-reminder',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Appointment',
        icon: '/favicon-16x16.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon-16x16.png'
      }
    ],
    data: {
      url: '/',
      appointmentId: null
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('Push notification data:', data);

      options.body = data.body || options.body;
      options.data = { ...options.data, ...data.data };

      if (data.title) {
        options.title = data.title;
      }

      if (data.icon) {
        options.icon = data.icon;
      }

      if (data.actions) {
        options.actions = data.actions;
      }

      if (data.tag) {
        options.tag = data.tag;
      }
    } catch (error) {
      console.error('Error parsing push notification data:', error);
    }
  }

  const title = options.title || 'TheraSuite Appointment Reminder';

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event handler
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received:', event);

  const notification = event.notification;
  const action = event.action;

  notification.close();

  if (action === 'dismiss') {
    return;
  }

  const urlToOpen = notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
          return client.focus();
        }
      }

      // If no existing window/tab, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for failed notification subscriptions
self.addEventListener('sync', function(event) {
  console.log('Background sync event:', event);

  if (event.tag === 'push-subscription-sync') {
    event.waitUntil(
      // Retry failed subscription operations
      syncPushSubscription()
    );
  }
});

async function syncPushSubscription() {
  try {
    // Check if we need to retry any failed subscription operations
    // This could involve retrying subscription registration or cleanup
    console.log('Syncing push subscription...');
    
    // Implementation would depend on your specific sync requirements
    // For now, this is a placeholder for future sync logic
  } catch (error) {
    console.error('Failed to sync push subscription:', error);
  }
}

// Handle notification close event (optional)
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event);
  
  // Track notification dismissal if needed
  const notification = event.notification;
  
  // You could send analytics data here
  console.log('Notification dismissed:', {
    tag: notification.tag,
    data: notification.data
  });
});

// Message handler for communication with main thread
self.addEventListener('message', function(event) {
  console.log('Service Worker received message:', event);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: '1.0.0',
      timestamp: Date.now()
    });
  }
});

console.log('TheraSuite Service Worker loaded with push notification support');