import { useState } from 'react';
import { Bell, BellOff, Clock, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 20, label: '20 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' }
];

export function PushNotificationSettings() {
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    testNotification,
    clearError
  } = usePushNotifications();

  const {
    preferences,
    isLoading: preferencesLoading,
    error: preferencesError,
    toggleAppointmentReminders,
    updateReminderTiming
  } = useNotificationPreferences();

  const handleSubscribeToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
    }
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    setTestError(null);
    setTestSuccess(false);

    try {
      await testNotification();
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 3000);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Failed to send test notification');
    } finally {
      setIsTestingNotification(false);
    }
  };

  const handleReminderToggle = async (enabled: boolean) => {
    try {
      await toggleAppointmentReminders(enabled);
    } catch (error) {
      console.error('Failed to toggle appointment reminders:', error);
    }
  };

  const handleReminderTimingChange = async (minutes: string) => {
    try {
      await updateReminderTiming(parseInt(minutes));
    } catch (error) {
      console.error('Failed to update reminder timing:', error);
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Granted</Badge>;
      case 'denied':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Denied</Badge>;
      default:
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Not Set</Badge>;
    }
  };

  const getSubscriptionStatus = () => {
    if (isLoading) {
      return <Badge variant="outline">Loading...</Badge>;
    }
    if (isSubscribed) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
    }
    return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Inactive</Badge>;
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notification Settings
          </CardTitle>
          <CardDescription>
            Manage your appointment reminder notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission and Subscription Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Permission Status</Label>
                <p className="text-sm text-muted-foreground">Browser notification permission</p>
              </div>
              {getPermissionStatus()}
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Subscription Status</Label>
                <p className="text-sm text-muted-foreground">Push notification subscription</p>
              </div>
              {getSubscriptionStatus()}
            </div>
          </div>

          <Separator />

          {/* Enable/Disable Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Enable Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications for appointment reminders
              </p>
            </div>
            <Switch
              checked={isSubscribed}
              onCheckedChange={handleSubscribeToggle}
              disabled={isLoading || permission === 'denied'}
            />
          </div>

          {/* Appointment Reminders Settings */}
          {isSubscribed && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Appointment Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get reminded about upcoming appointments
                    </p>
                  </div>
                  <Switch
                    checked={preferences?.appointment_reminder_enabled ?? true}
                    onCheckedChange={handleReminderToggle}
                    disabled={preferencesLoading}
                  />
                </div>

                {preferences?.appointment_reminder_enabled && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Reminder Timing
                    </Label>
                    <Select
                      value={preferences?.reminder_minutes_before?.toString() ?? '15'}
                      onValueChange={handleReminderTimingChange}
                      disabled={preferencesLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select reminder timing" />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Test Notification */}
          {/* {isSubscribed && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Test Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send a test notification to make sure everything is working
                  </p>
                </div>
                
                <Button
                  onClick={handleTestNotification}
                  disabled={isTestingNotification}
                  variant="outline"
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTestingNotification ? 'Sending...' : 'Send Test Notification'}
                </Button>

                {testSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">
                      Test notification sent successfully! Check your notifications.
                    </AlertDescription>
                  </Alert>
                )}

                {testError && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-800">
                      {testError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )} */}

          {/* Error Display */}
          {(error || preferencesError) && (
            <>
              <Separator />
              
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-800">
                  {error || preferencesError}
                </AlertDescription>
              </Alert>
              
              {error && (
                <Button onClick={clearError} variant="outline" size="sm">
                  Clear Error
                </Button>
              )}
            </>
          )}

          {/* Help Text */}
          {permission === 'denied' && (
            <>
              <Separator />
              
              <Alert>
                <AlertDescription>
                  Notifications are blocked. To enable them, click the notification icon in your browser's address bar or go to your browser settings and allow notifications for this site.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}