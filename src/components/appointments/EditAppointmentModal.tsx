import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatDateWithTimezone } from '@/lib/timezone';
import { decryptSingleValue } from '@/lib/encryption';
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Input } from "@/components/ui/input";
import { Database } from "@/types/database.types";
import { Appointment } from "@/types/supabase";

const formSchema = z.object({
  session_date: z.date({
    required_error: "Please select a new session date",
    invalid_type_error: "Invalid date format",
  }),
  session_time: z.string({
    required_error: "Please select a session time",
    invalid_type_error: "Invalid time format",
  }).regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time in HH:MM format"),
  session_length: z.enum(["30", "60", "90", "120"], {
    required_error: "Please select a session length",
    invalid_type_error: "Please select a valid session length (30, 60, 90, or 120 minutes)",
  }),
  notes: z.string({
    invalid_type_error: "Notes must be text",
  })
    .max(1000, "Notes cannot exceed 1000 characters")
    .optional()
    .transform(val => val || ""), // Transform empty string to null
});

type FormValues = z.infer<typeof formSchema>;

// Add a type for form errors to track multiple errors
type FormErrors = {
  [key: string]: string;
};

interface EditAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onSuccess?: () => void;
}

// Form content component
function EditAppointmentForm({
  form,
  onSubmit,
  formError,
  formErrors,
  isSubmitting,
  className
}: {
  form: any;
  onSubmit: (values: FormValues) => Promise<void>;
  formError: string | null;
  formErrors: FormErrors;
  isSubmitting: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md mb-4">
          {formError}
        </div>
      )}
      {Object.keys(formErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md mb-4">
          <p className="font-semibold mb-1">Please fix the following errors:</p>
          <ul className="list-disc list-inside">
            {Object.entries(formErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="session_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <DatePicker
                      selected={field.value}
                      onChange={(date: Date) => field.onChange(date)}
                      minDate={new Date()}
                      placeholderText="Select date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="session_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      step="900" // 15 minute intervals
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="session_length"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Length</FormLabel>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                >
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                  <option value="120">120 minutes</option>
                </select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add any additional notes..."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}

export function EditAppointmentModal({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: EditAppointmentModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Check for stored values from drag and drop
  useEffect(() => {
    if (open && appointment) {
      const storedValues = sessionStorage.getItem('editAppointmentValues');
      if (storedValues) {
        try {
          const values = JSON.parse(storedValues);
          
          // Update form with the stored values
          form.setValue('session_date', new Date(values.session_date));
          form.setValue('session_time', values.session_time);
          form.setValue('session_length', String(values.session_length) as "30" | "60" | "90" | "120");
          
          // Clear the stored values
          sessionStorage.removeItem('editAppointmentValues');
        } catch (error) {
          console.error('Error parsing stored values:', error);
        }
      }
    }
  }, [open, appointment]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      session_date: appointment ? new Date(appointment.session_date) : undefined,
      session_time: appointment ? format(new Date(appointment.session_date), "HH:mm") : "",
      session_length: appointment ? String(appointment.session_length) as "30" | "60" | "90" | "120" : "60",
      notes: appointment?.notes || "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setFormErrors({});
    setIsSubmitting(true);
    
    try {
      if (!appointment) {
        setFormError("No appointment found to update");
        return;
      }

      // Combine date and time
      const [hours, minutes] = values.session_time.split(":");
      const session_date = new Date(values.session_date);
      session_date.setHours(parseInt(hours), parseInt(minutes));

      // Validate that the new date is in the future
      if (session_date < new Date()) {
        setFormError("Cannot reschedule an appointment to a past date and time");
        return;
      }

      // Additional validation
      const errors: FormErrors = {};
      
      if (!values.session_date) {
        errors.session_date = "Session date is required";
      }
      
      if (!values.session_time) {
        errors.session_time = "Session time is required";
      }
      
      if (!values.session_length) {
        errors.session_length = "Session length is required";
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const updateData = {
        session_date: session_date.toISOString(),
        session_length: parseInt(values.session_length),
        notes: values.notes,
      };

      const { error } = await (supabase as any)
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id);

      if (error) {
        console.error('Update error:', error);
        throw new Error(error.message || "Failed to update appointment");
      }

      // Update notification queue for rescheduled appointment
      try {
        // Get user's notification preferences to calculate new reminder time
        const { data: preferences } = await supabase
          .from('notification_preferences')
          .select('appointment_reminder_enabled, reminder_minutes_before')
          .eq('user_id', appointment.therapist_id)
          .maybeSingle();

        if (preferences && (preferences as any).appointment_reminder_enabled) {
          const reminderMinutes = (preferences as any).reminder_minutes_before || 15;
          const reminderTime = new Date(session_date.getTime() - (reminderMinutes * 60 * 1000));
          
          // Check if the ORIGINAL appointment was within 2 hours (when notification would exist)
          // This handles the case where appointment is rescheduled from within 2hrs to outside 2hrs
          const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
          const originalAppointmentDate = new Date(appointment.session_date);
          const wasOriginalWithinWindow = originalAppointmentDate <= twoHoursFromNow;

          if (wasOriginalWithinWindow) {
            // Check if a pending notification exists for this appointment
            const { data: pendingNotifications, error: fetchError } = await (supabase as any)
              .from("notification_queue")
              .select("*")
              .eq("appointment_id", appointment.id)
              .eq("notification_type", "appointment_reminder")
              .eq("status", "pending");

            if (fetchError) {
              console.error('Error fetching notification:', fetchError);
            } else if (!pendingNotifications || pendingNotifications.length === 0) {
              // No notification to update
            } else {
              const existingNotification = pendingNotifications[0];
              
              // Check if new appointment is still within notification window
              const newAppointmentWithinWindow = session_date <= twoHoursFromNow;
              
              if (newAppointmentWithinWindow && reminderTime > new Date()) {
                // Case 1: Rescheduling within the 2-hour window - update the notification time
                const { error: updateError } = await (supabase as any)
                  .from("notification_queue")
                  .update({ scheduled_for: reminderTime.toISOString() })
                  .eq("id", existingNotification.id);

                if (updateError) {
                  console.error('Error updating notification schedule:', updateError);
                }
              } else {
                // Case 2: Rescheduling outside the 2-hour window OR reminder time is in the past
                // Cancel the existing notification to prevent false alerts
                const { error: cancelError } = await (supabase as any)
                  .from("notification_queue")
                  .update({ status: 'cancelled' })
                  .eq("id", existingNotification.id);

                if (cancelError) {
                  console.error('Error cancelling notification:', cancelError);
                }
              }
            }
          }
        }
      } catch (notificationError) {
        console.error('Error updating notification queue:', notificationError);
        // Don't throw here - appointment update was successful, notification is secondary
      }

      // Send rescheduling email
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session');

        // Get therapist details
        const { data: therapist } = await supabase
          .from('profiles')
          .select('full_name, photo_url')
          .eq('id', appointment.therapist_id)
          .single();

        // Get client timezone
        let clientTimezone = 'Asia/Kolkata'; // default
        try {
          const { data: clientData, error: timezoneError } = await supabase
            .from('clients')
            .select('timezone')
            .eq('id', appointment.client_id)
            .eq('therapist_id', appointment.therapist_id)
            .single();
          
          if (timezoneError) {
            console.warn('Could not fetch client timezone, using default:', timezoneError);
          } else if (clientData && (clientData as any).timezone) {
            clientTimezone = (clientData as any).timezone;
          }
        } catch (error) {
          console.warn('Could not fetch client timezone, using default:', error);
        }

        // Format dates with timezone (with error handling)
        let formattedSessionDate, formattedOldDate;
        try {
          formattedSessionDate = formatDateWithTimezone(session_date.toISOString(), clientTimezone, 'PPP p');
          formattedOldDate = formatDateWithTimezone(appointment.session_date, clientTimezone, 'PPP p');
        } catch (error) {
          console.error('Error formatting dates:', error);
          // Fallback to simple date formatting without timezone
          formattedSessionDate = new Date(session_date).toLocaleString();
          formattedOldDate = new Date(appointment.session_date).toLocaleString();
        }

        // Decrypt client data for email
        let decryptedClientName, decryptedClientEmail;
        try {
          decryptedClientName = await decryptSingleValue(appointment.client_name);
          decryptedClientEmail = await decryptSingleValue(appointment.client_email);
        } catch (error) {
          console.error('Error decrypting client data:', error);
          // Fallback to encrypted values (though email will fail)
          decryptedClientName = appointment.client_name;
          decryptedClientEmail = appointment.client_email;
        }

        const emailData = {
          type: 'appointment_rescheduled',
          data: {
            client_name: decryptedClientName,
            client_email: decryptedClientEmail,
            session_date: session_date.toISOString(),
            session_type: appointment.session_type,
            session_length: parseInt(values.session_length),
            therapist_name: (therapist && (therapist as any).full_name) ? (therapist as any).full_name : 'Your Therapist',
            therapist_photo_url: (therapist && (therapist as any).photo_url) ? (therapist as any).photo_url : '',
            old_date: appointment.session_date,
            formatted_session_date: formattedSessionDate,
            formatted_old_date: formattedOldDate,
            client_timezone: clientTimezone
          }
        };

        const emailResponse = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(emailData)
        });

        if (!emailResponse.ok) {
          console.error('Failed to send rescheduling email');
          // Don't throw, just show a warning toast
          toast({
            title: "Warning",
            description: "Appointment updated but confirmation email could not be sent",
            variant: "default",
          });
        }
      } catch (emailError) {
        console.error('Email error:', emailError);
        // Don't throw, just show a warning toast
        toast({
          title: "Warning",
          description: "Appointment updated but confirmation email could not be sent",
          variant: "default",
        });
      }

      toast({
        title: "Success",
        description: "Appointment updated successfully",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Update error:', error);
      setFormError(error.message || "Failed to update appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formProps = {
    form,
    onSubmit,
    formError,
    formErrors,
    isSubmitting,
  };

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <EditAppointmentForm {...formProps} />
          <div className="flex justify-end">
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Reschedule Appointment</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto flex-1">
          <EditAppointmentForm {...formProps} />
        </div>
        <DrawerFooter className="pt-2">
          <Button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Appointment
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
} 