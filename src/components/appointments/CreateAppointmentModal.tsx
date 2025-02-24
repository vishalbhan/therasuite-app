import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, getInitials, generateRandomColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { emailService } from '@/lib/email';
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

const PURPLE_GRADIENT = "bg-[#F5F1FF]";
const DISABLED_INPUT_BG = "bg-gray-50";

const formSchema = z.object({
  client_name: z.string().min(2, "Name must be at least 2 characters"),
  client_email: z.string().email("Invalid email address"),
  session_date: z.date({
    required_error: "Please select a date",
  }),
  session_time: z.string({
    required_error: "Please select a time",
  }),
  session_length: z.enum(["30", "60", "90", "120"], {
    required_error: "Please select session length",
  }),
  session_type: z.enum(["video", "in_person"], {
    required_error: "Please select session type",
  }),
  price: z.string().min(1, "Price is required").transform((val) => parseFloat(val)),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurring_day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).optional(),
  number_of_sessions: z.union([
    z.string(),
    z.number()
  ]).transform((val) => {
    if (typeof val === 'string') {
      if (val === '') return undefined;
      const num = parseInt(val);
      return isNaN(num) ? undefined : num;
    }
    return val;
  }).pipe(
    z.number().min(2).max(52).optional()
  ),
});

interface CreateAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string | null;
  defaultClient?: { name: string; email: string } | null;
  onAppointmentCreated?: () => void;
  disableClientFields?: boolean;
}

export function CreateAppointmentModal({
  open,
  onOpenChange,
  defaultDate,
  defaultClient,
  onAppointmentCreated,
  disableClientFields = false
}: CreateAppointmentModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: defaultClient?.name || "",
      client_email: defaultClient?.email || "",
      session_date: defaultDate ? new Date(defaultDate) : undefined,
      session_time: defaultDate ? format(new Date(defaultDate), "HH:mm") : "",
      session_length: "60",
      session_type: "video",
      price: "",
      notes: "",
      is_recurring: false,
      recurring_day: undefined,
      number_of_sessions: undefined,
    },
  });

  const isRecurring = form.watch('is_recurring');

  useEffect(() => {
    if (defaultClient) {
      form.setValue('client_name', defaultClient.name);
      form.setValue('client_email', defaultClient.email);
    }
  }, [defaultClient, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    setIsCreatingMultiple(values.is_recurring);
    let successCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Combine date and time for the first appointment
      const [hours, minutes] = values.session_time.split(":");
      let session_date = new Date(values.session_date);
      session_date.setHours(parseInt(hours), parseInt(minutes));

      // If recurring, create multiple appointments
      const appointmentsToCreate = values.is_recurring ? values.number_of_sessions! : 1;

      for (let i = 0; i < appointmentsToCreate; i++) {
        // First, create or update the client
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .upsert({
            therapist_id: user.id,
            name: values.client_name,
            email: values.client_email,
            avatar_color: generateRandomColor(),
            initials: getInitials(values.client_name),
          }, {
            onConflict: 'therapist_id,email'
          })
          .select()
          .single();

        if (clientError) throw clientError;

        const appointmentData = {
          therapist_id: user.id,
          client_id: client.id,
          client_name: values.client_name,
          client_email: values.client_email,
          session_date: session_date.toISOString(),
          session_length: parseInt(values.session_length),
          session_type: values.session_type,
          price: parseFloat(values.price),
          notes: values.notes,
          status: 'scheduled'
        };

        // Create appointment
        const { data: appointment, error: appointmentError } = await supabase
          .from("appointments")
          .insert(appointmentData)
          .select()
          .single();

        if (appointmentError) throw appointmentError;

        // If this is a video appointment, create the Dyte meeting
        if (values.session_type === 'video') {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/create-dyte-meeting`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                'Content-Type': 'application/json',
              },
              mode: 'cors',
              body: JSON.stringify({
                appointmentId: appointment.id,
                therapistId: user.id,
                clientEmail: values.client_email,
              }),
            }
          );

          if (!response.ok) {
            let errorMessage = 'Failed to create meeting';
            try {
              const errorData = await response.json();
              errorMessage = errorData.details || errorMessage;
            } catch (e) {
              console.error('Error parsing response:', e);
            }
            throw new Error(errorMessage);
          }
        }

        // Send confirmation email last
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No active session');

          const emailResponse = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              type: 'appointment_confirmation',
              data: {
                client_name: values.client_name,
                client_email: values.client_email,
                session_date: session_date.toISOString(),
                session_type: values.session_type,
                session_length: parseInt(values.session_length)
              }
            })
          });

          if (!emailResponse.ok) {
            const error = await emailResponse.json();
            console.error('Email error:', error);
            throw new Error('Failed to send confirmation email');
          }
        } catch (emailError) {
          console.error('Email error:', emailError);
          // Don't throw here, just show a warning toast
          toast({
            title: "Warning",
            description: "Appointment created but confirmation email could not be sent",
            variant: "warning",
          });
          // Return early to avoid showing success message
          onOpenChange(false);
          form.reset();
          return;
        }

        successCount++;
        setCreatedCount(successCount);

        // If recurring, calculate next date
        if (values.is_recurring) {
          // Add 7 days to get to next week
          session_date = new Date(session_date.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
      }

      toast({
        title: "Success",
        description: values.is_recurring 
          ? `${successCount} appointments created successfully`
          : "Appointment created successfully",
      });

      onAppointmentCreated?.();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('Full error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsCreatingMultiple(false);
      setCreatedCount(0);
    }
  };

  // Replace the timeSlots generation and the FormField for session_time with this:
  const timeSlots = Array.from({ length: 96 }, (_, i) => {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {isCreatingMultiple && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-50">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="mt-2 text-sm text-muted-foreground">
              Creating appointments... ({createdCount} of {form.getValues('number_of_sessions')})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please do not refresh or close the page
            </p>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>Create New Appointment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="is_recurring"
              render={({ field }) => (
                <FormItem className={cn(
                  "flex flex-row items-center justify-between rounded-lg border p-4",
                  PURPLE_GRADIENT
                )}>
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Recurring Appointment</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Create multiple appointments at once
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="John Doe" 
                      {...field} 
                      disabled={disableClientFields}
                      className={cn(
                        disableClientFields && DISABLED_INPUT_BG
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="client@example.com" 
                      {...field} 
                      disabled={disableClientFields}
                      className={cn(
                        disableClientFields && DISABLED_INPUT_BG
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isRecurring && (
              <>
                <FormField
                  control={form.control}
                  name="recurring_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repeat Every</FormLabel>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="monday">Every Monday</option>
                        <option value="tuesday">Every Tuesday</option>
                        <option value="wednesday">Every Wednesday</option>
                        <option value="thursday">Every Thursday</option>
                        <option value="friday">Every Friday</option>
                        <option value="saturday">Every Saturday</option>
                        <option value="sunday">Every Sunday</option>
                      </select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="number_of_sessions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Sessions</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="2"
                          max="52"
                          {...field}
                          value={field.value || ''}
                          onChange={e => {
                            const value = e.target.value;
                            field.onChange(value === '' ? undefined : parseInt(value));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="session_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
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
              name="session_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Type</FormLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    {...field}
                  >
                    <option value="video">Video Call</option>
                    <option value="in_person">In Person</option>
                  </select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2">₹</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className="pl-7"
                        placeholder="0"
                        {...field}
                      />
                    </div>
                  </FormControl>
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

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 