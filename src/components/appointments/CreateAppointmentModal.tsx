import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Database } from "@/types/supabase";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useCurrency } from '@/contexts/CurrencyContext';

const PURPLE_GRADIENT = "bg-[#F5F1FF]";
const DISABLED_INPUT_BG = "bg-gray-50";

const formSchema = z.object({
  client_name: z.string({
    required_error: "Client name is required",
  })
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name cannot exceed 100 characters")
    .trim(),
  client_email: z.string({
    required_error: "Client email is required",
  })
    .email("Please enter a valid email address")
    .min(1, "Email is required")
    .trim(),
  session_date: z.date({
    required_error: "Please select a session date",
    invalid_type_error: "Invalid date format",
  }),
  session_time: z.string({
    required_error: "Please select a session time",
  }).regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time in HH:MM format"),
  session_length: z.enum(["30", "45", "60", "75", "90", "105", "120", "135", "150", "165", "180"], {
    required_error: "Please select a session length",
    invalid_type_error: "Please select a valid session length",
  }),
  session_type: z.enum(["video", "in_person"], {
    required_error: "Please select a session type",
    invalid_type_error: "Please select either video call or in-person session",
  }),
  video_provider: z.enum(["therasuite", "google_meet", "zoom"])
    .nullable(),
  custom_meeting_link: z.string()
    .nullable()
    .optional()
    .refine((val) => {
      if (val === '') return true;
      if (!val) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, "Please enter a valid URL"),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postal_code: z.string()
  }).optional(),
  price: z.string({
    required_error: "Price is required",
  })
    .min(1, "Price is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Please enter a valid price (e.g., 100 or 100.50)")
    .transform((val) => parseFloat(val)),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurring_day: z.enum(
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    { 
      required_error: "Please select a day for recurring appointments",
      invalid_type_error: "Please select a valid day of the week",
    }
  ).optional(),
  number_of_sessions: z.number({
    required_error: "Number of sessions is required for recurring appointments",
    invalid_type_error: "Please enter a valid number",
  })
    .min(2, "Must schedule at least 2 sessions for recurring appointments")
    .max(52, "Cannot schedule more than 52 recurring sessions")
    .optional(),
}).refine(
  (data) => {
    // If is_recurring is true, number_of_sessions must be provided
    if (data.is_recurring) {
      return data.number_of_sessions !== undefined;
    }
    return true;
  },
  {
    message: "Number of sessions is required for recurring appointments",
    path: ["number_of_sessions"],
  }
).refine(
  (data) => {
    // If session type is video, video_provider is required
    if (data.session_type === 'video') {
      return !!data.video_provider;
    }
    return true;
  },
  {
    message: "Please select a video provider",
    path: ["video_provider"],
  }
).refine(
  (data) => {
    // If session type is video and provider is external, custom link is required
    if (data.session_type === 'video' && data.video_provider && data.video_provider !== 'therasuite') {
      return !!data.custom_meeting_link && data.custom_meeting_link !== '';
    }
    return true;
  },
  {
    message: "Meeting link is required for external video providers",
    path: ["custom_meeting_link"],
  }
);

type FormValues = z.infer<typeof formSchema>;

type ClientSelectionMode = 'new' | 'existing';

interface ExistingClient {
  id: string;
  name: string;
  email: string;
}

interface CreateAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string | null;
  defaultClient?: { name: string; email: string } | null;
  onAppointmentCreated?: () => void;
  disableClientFields?: boolean;
}

// Add a type for the location structure
type LocationData = {
  city: string;
  state: string;
  address: string;
  country: string;
  postal_code: string;
};

// Add proper type definitions for database tables
interface DatabaseTables {
  clients: {
    Row: any;
    Insert: {
      therapist_id: string;
      name: string;
      email: string;
      avatar_color: string;
      initials: string;
      [key: string]: any;
    };
    Update: any;
  };
  appointments: {
    Row: any;
    Insert: {
      therapist_id: string;
      client_id: string;
      client_name: string;
      client_email: string;
      session_date: string;
      session_length: number;
      session_type: "video" | "in_person";
      price: number;
      notes?: string;
      status: "scheduled" | "completed" | "cancelled" | "expired";
      video_provider: string | null;
      custom_meeting_link: string | null;
      [key: string]: any;
    };
    Update: any;
  };
  profiles: {
    Row: {
      id: string;
      created_at?: string;
      email?: string;
      full_name?: string;
      photo_url?: string;
      location?: LocationData | string;
      [key: string]: any;
    };
    Insert: any;
    Update: any;
  };
}

// Update the Database type
type Database = {
  public: {
    Tables: DatabaseTables;
    Views: {};
    Functions: {};
    Enums: {};
  };
};

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
  const [clientMode, setClientMode] = useState<ClientSelectionMode>('new');
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const { currency } = useCurrency();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: defaultClient?.name || "",
      client_email: defaultClient?.email || "",
      session_date: defaultDate ? new Date(defaultDate) : undefined,
      session_time: defaultDate ? format(new Date(defaultDate), "HH:mm") : "",
      session_length: "60",
      session_type: "video",
      video_provider: "therasuite",
      custom_meeting_link: null,
      location: {
        address: "",
        city: "",
        state: "",
        country: "",
        postal_code: ""
      },
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

  useEffect(() => {
    const fetchClients = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('therapist_id', user.id);

      if (error) {
        console.error('Error fetching clients:', error);
        return;
      }

      setExistingClients(clients || []);
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const sessionType = form.watch('session_type');
    
    const updateLocation = async () => {
      if (sessionType === 'in_person') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: therapist, error } = await supabase
          .from('profiles')
          .select('location')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching therapist profile:', error);
          return;
        }

        if (therapist?.location) {
          try {
            // Parse the location if it's a string
            let locationData: LocationData;
            
            if (typeof therapist.location === 'string') {
              locationData = JSON.parse(therapist.location);
            } else {
              locationData = therapist.location as LocationData;
            }
            
            // Check if we have any non-empty values
            const hasValidData = Object.values(locationData).some(value => value && value.trim() !== '');
            
            if (hasValidData) {
              form.setValue('location', locationData);
            } else {
              form.setValue('location', {
                address: "",
                city: "",
                state: "",
                country: "",
                postal_code: ""
              });
            }
          } catch (error) {
            form.setValue('location', {
              address: "",
              city: "",
              state: "",
              country: "",
              postal_code: ""
            });
          }
        } else {
          form.setValue('location', {
            address: "",
            city: "",
            state: "",
            country: "",
            postal_code: ""
          });
        }
      } else {
        // Clear location when switching to video
        form.setValue('location', {
          address: "",
          city: "",
          state: "",
          country: "",
          postal_code: ""
        });
      }
    };

    updateLocation();
  }, [form.watch('session_type')]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setIsCreatingMultiple(values.is_recurring);
    setFormError(null);
    let successCount = 0;

    try {
      const [hours, minutes] = values.session_time.split(":");
      let session_date = new Date(values.session_date);
      session_date.setHours(parseInt(hours), parseInt(minutes));
      
      if (session_date < new Date()) {
        setFormError("Cannot schedule an appointment in the past");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFormError("You must be logged in to create appointments");
        return;
      }

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
          } as Database['public']['Tables']['clients']['Insert'], {
            onConflict: 'therapist_id,email'
          })
          .select()
          .single();

        if (clientError) throw clientError;

        const appointmentData: Database['public']['Tables']['appointments']['Insert'] = {
          therapist_id: user.id,
          client_id: client.id,
          client_name: values.client_name,
          client_email: values.client_email,
          session_date: session_date.toISOString(),
          session_length: parseInt(values.session_length),
          session_type: values.session_type,
          price: values.price,
          notes: values.notes,
          status: 'scheduled',
          video_provider: values.session_type === 'video' ? values.video_provider : null,
          custom_meeting_link: values.session_type === 'video' && values.video_provider !== 'therasuite' 
            ? values.custom_meeting_link 
            : null,
        };

        // Create appointment
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .insert(appointmentData)
          .select()
          .single();

        if (appointmentError) throw appointmentError;

        // Only create Dyte meeting if using TheraSuite video
        if (values.session_type === 'video' && values.video_provider === 'therasuite') {
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

        // Update email sending to include the correct video link
        const videoLink = values.video_provider === 'therasuite' 
          ? `${window.location.origin}/client-video/${appointment.id}`
          : values.custom_meeting_link;

        // Send confirmation email last
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No active session');

          // Get therapist details
          const { data: therapist, error: therapistError } = await supabase
            .from('profiles')
            .select('full_name, photo_url')
            .eq('id', user.id)
            .single();

          if (therapistError) {
            console.error('Error fetching therapist details:', therapistError);
          }

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
                session_length: parseInt(values.session_length),
                therapist_name: therapist?.full_name || 'Your Therapist',
                therapist_photo_url: therapist?.photo_url || '',
                location: values.session_type === 'in_person' ? 
                  `${values.location.address}, ${values.location.city}, ${values.location.state} - ${values.location.postal_code}, ${values.location.country}` 
                  : undefined,
                video_link: videoLink,
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
            variant: "default",
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
      setFormError(error.message || "Failed to create appointment");
    } finally {
      setIsSubmitting(false);
      setIsCreatingMultiple(false);
      setCreatedCount(0);
    }
  };

  const handleClientSelection = (clientId: string) => {
    const selectedClient = existingClients.find(client => client.id === clientId);
    if (selectedClient) {
      form.setValue('client_name', selectedClient.name);
      form.setValue('client_email', selectedClient.email);
      setSelectedClientId(clientId);
    }
  };

  // Update the useEffect that watches is_recurring to also handle video provider
  useEffect(() => {
    if (form.watch('is_recurring')) {
      const selectedDate = form.watch('session_date');
      if (selectedDate) {
        const dayOfWeek = selectedDate.getDay();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        form.setValue('recurring_day', days[dayOfWeek] as any);
      }
      // Force video provider to TheraSuite when recurring is enabled
      form.setValue('video_provider', 'therasuite');
    }
  }, [form.watch('session_date'), form.watch('is_recurring')]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] md:max-w-[800px] my-4">
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
          <DialogTitle className="mb-4">Create New Appointment</DialogTitle>
        </DialogHeader>
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md mb-4">
            {formError}
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
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

                <div className="space-y-4">
                  <RadioGroup
                    defaultValue="new"
                    className="grid grid-cols-2 gap-4"
                    onValueChange={(value: ClientSelectionMode) => {
                      setClientMode(value);
                      if (value === 'new') {
                        form.setValue('client_name', '');
                        form.setValue('client_email', '');
                        setSelectedClientId('');
                      }
                    }}
                  >
                    <div>
                      <RadioGroupItem
                        value="new"
                        id="new"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="new"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span className="text-sm font-medium">New Client</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="existing"
                        id="existing"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="existing"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span className="text-sm font-medium">Existing Client</span>
                      </Label>
                    </div>
                  </RadioGroup>

                  {clientMode === 'new' ? (
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
                  ) : (
                    <FormItem>
                      <FormLabel>Select Client</FormLabel>
                      <select
                        value={selectedClientId}
                        onChange={(e) => handleClientSelection(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select an existing client</option>
                        {existingClients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </FormItem>
                  )}
                </div>

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

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any additional notes..."
                          className="resize-none h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                {isRecurring && (
                  <>
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
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {isRecurring && (
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
                )}

                <FormField
                  control={form.control}
                  name="session_length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Length</FormLabel>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="75">1 hour 15 minutes</option>
                        <option value="90">1 hour 30 minutes</option>
                        <option value="105">1 hour 45 minutes</option>
                        <option value="120">2 hours</option>
                        <option value="135">2 hours 15 minutes</option>
                        <option value="150">2 hours 30 minutes</option>
                        <option value="165">2 hours 45 minutes</option>
                        <option value="180">3 hours</option>
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
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="video">Video Call</option>
                        <option value="in_person">In Person</option>
                      </select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('session_type') === 'in_person' && (
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input
                            readOnly
                            value={field.value && Object.values(field.value).some(v => v && v.trim() !== '') ? 
                              `${field.value.address}, ${field.value.city}, ${field.value.state} - ${field.value.postal_code}, ${field.value.country}`
                              : 'No location set - please update your location in Settings'
                            }
                            placeholder="No location set"
                            className="text-muted-foreground"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch('session_type') === 'video' && (
                  <>
                    <FormField
                      control={form.control}
                      name="video_provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video Provider</FormLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            {...field}
                            value={field.value || 'therasuite'}
                            onChange={(e) => {
                              field.onChange(e);
                              // Clear custom meeting link when switching to TheraSuite
                              if (e.target.value === 'therasuite') {
                                form.setValue('custom_meeting_link', null);
                              }
                            }}
                            disabled={form.watch('is_recurring')} // Disable when recurring
                          >
                            <option value="therasuite">TheraSuite Video</option>
                            <option value="google_meet">Google Meet</option>
                            <option value="zoom">Zoom</option>
                          </select>
                          {form.watch('is_recurring') && (
                            <p className="text-xs text-slate-600 text-muted-foreground mt-1">
                              Recurring appointments must use TheraSuite Video
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch('video_provider') !== 'therasuite' && (
                      <FormField
                        control={form.control}
                        name="custom_meeting_link"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meeting Link</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                placeholder="https://meet.google.com/... or https://zoom.us/..."
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => {
                                  field.onChange(e.target.value || null);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2">
                            {currency === 'USD' ? '$' : 
                             currency === 'EUR' ? '€' : 
                             currency === 'GBP' ? '£' : 
                             currency === 'AUD' ? 'A$' : 
                             currency === 'CAD' ? 'C$' : 
                             '₹'}
                          </span>
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
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
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