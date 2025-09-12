import { useState } from 'react';
import { Bell, X, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NotificationPermissionPromptProps {
  onDismiss?: () => void;
  onGranted?: () => void;
  className?: string;
}

export function NotificationPermissionPrompt({
  onDismiss,
  onGranted,
  className
}: NotificationPermissionPromptProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const {
    permission,
    isSupported,
    subscribe,
    error,
    clearError
  } = usePushNotifications();

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    clearError();

    try {
      const subscription = await subscribe();
      if (subscription) {
        onGranted?.();
        setIsDismissed(true);
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't show if not supported, already granted, or dismissed
  if (!isSupported || permission === 'granted' || isDismissed) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Enable Appointment Notifications</CardTitle>
              <CardDescription className="text-sm">
                Never miss an appointment again
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Timely Reminders</p>
              <p className="text-sm text-muted-foreground">
                Get notified 15 minutes before your appointments (customizable)
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Never Miss an Appointment</p>
              <p className="text-sm text-muted-foreground">
                Receive notifications even when the app is closed
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800 text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {permission === 'denied' && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertDescription className="text-yellow-800 text-sm">
              Notifications are currently blocked. Please enable them in your browser settings to receive appointment reminders.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-2">
          <Button 
            onClick={handleRequestPermission}
            disabled={isRequesting || permission === 'denied'}
            className="flex-1"
          >
            <Bell className="h-4 w-4 mr-2" />
            {isRequesting ? 'Requesting...' : 'Enable Notifications'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleDismiss}
            className="flex-1"
          >
            Maybe Later
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can change this setting anytime in your preferences
        </p>
      </CardContent>
    </Card>
  );
}