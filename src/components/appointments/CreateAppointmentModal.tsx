import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, getInitials, generateRandomColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
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
import { Loader2, CheckCircle, Calendar as CalendarIcon2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useCurrency } from '@/contexts/CurrencyContext';
import { encryptClientData, decryptSingleValue } from '@/lib/encryption';

const PURPLE_GRADIENT = "bg-[#F5F1FF]";
const DISABLED_INPUT_BG = "bg-gray-50";

// Add interface for the shape of fetched existing appointments
interface ExistingAppointmentData {
  session_date: string; // Expecting ISO string from DB
  session_length: number;
}

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
  recurring_frequency: z.enum(
    ['weekly', 'biweekly', 'monthly', 'bimonthly'],
    { 
      required_error: "Please select a frequency for recurring appointments",
      invalid_type_error: "Please select a valid frequency",
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
  decrypted_name?: string;
  decrypted_email?: string;
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

// Form component to be used in both Dialog and Drawer
function CreateAppointmentForm({
  form,
  onSubmit,
  formError,
  isSubmitting,
  isCreatingMultiple,
  createdCount,
  showSuccessOverlay,
  emailWarning,
  clientMode,
  setClientMode,
  existingClients,
  selectedClientId,
  handleClientSelection,
  disableClientFields,
  isRecurring,
  currency,
  createdAppointmentData,
  handleAddToCalendar,
  handleCloseSuccessModal,
  className
}: {
  form: any;
  onSubmit: (values: FormValues) => Promise<void>;
  formError: string | null;
  isSubmitting: boolean;
  isCreatingMultiple: boolean;
  createdCount: number;
  showSuccessOverlay: boolean;
  emailWarning: boolean;
  clientMode: ClientSelectionMode;
  setClientMode: (mode: ClientSelectionMode) => void;
  existingClients: ExistingClient[];
  selectedClientId: string;
  handleClientSelection: (clientId: string) => void;
  disableClientFields: boolean;
  isRecurring: boolean;
  currency: string;
  createdAppointmentData: FormValues | null;
  handleAddToCalendar: () => void;
  handleCloseSuccessModal: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
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
      {((isSubmitting && !isCreatingMultiple) || showSuccessOverlay) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-50">
          {!showSuccessOverlay ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-2 text-sm text-muted-foreground">
                Creating appointment...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Please do not refresh or close the page
              </p>
            </>
          ) : (
            <>
              <CheckCircle className="h-8 w-8 text-green-600" />
              <p className="mt-2 text-sm text-muted-foreground">
                Appointment created successfully!
              </p>
              {emailWarning && (
                <p className="mt-1 text-xs text-yellow-600">
                  Note: Confirmation email could not be sent
                </p>
              )}
              <div className="mt-4 space-y-2">
                <Button
                  onClick={handleAddToCalendar}
                  className="w-full"
                  variant="default"
                >
                  <CalendarIcon2 className="h-4 w-4 mr-2" />
                  Add to Google Calendar
                </Button>
                <Button
                  onClick={handleCloseSuccessModal}
                  className="w-full"
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md mb-4">
          {formError}
        </div>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                <div className="p-1 rounded-lg" style={{ backgroundColor: '#f1e7ff' }}>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('new');
                        form.setValue('client_name', '');
                        form.setValue('client_email', '');
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                        clientMode === 'new'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      New Client
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientMode('existing')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                        clientMode === 'existing'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Existing Client
                    </button>
                  </div>
                </div>

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
                          {client.decrypted_name || client.name}
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
                  name="recurring_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="">Select frequency</option>
                          <option value="weekly">Weekly (every 7 days)</option>
                          <option value="biweekly">Bi-Weekly (every 14 days)</option>
                          <option value="monthly">Monthly (every month)</option>
                          <option value="bimonthly">Bi-Monthly (every 2 months)</option>
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
        </form>
      </Form>
    </div>
  );
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
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [createdAppointmentData, setCreatedAppointmentData] = useState<FormValues | null>(null);
  const [emailWarning, setEmailWarning] = useState<boolean>(false);
  const [clientMode, setClientMode] = useState<ClientSelectionMode>(disableClientFields ? 'existing' : 'new');
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
      session_time: defaultDate ? format(new Date(defaultDate), 'HH:mm') : "",
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
      price: 0,
      notes: "",
      is_recurring: false,
      recurring_frequency: undefined,
      number_of_sessions: undefined,
    },
  });

  useEffect(() => {
    if (defaultDate) {
      const date = new Date(defaultDate);
      form.setValue('session_date', date);
      form.setValue('session_time', format(date, 'HH:mm'));
    }
  }, [defaultDate, form]);

  // Reset client mode when modal opens/closes
  useEffect(() => {
    if (open) {
      // Set initial client mode based on whether we have a default client
      if (defaultClient) {
        setClientMode('existing');
      } else if (!disableClientFields) {
        setClientMode('new');
      }
    }
  }, [open, defaultClient, disableClientFields]);

  const isRecurring = form.watch('is_recurring');

  useEffect(() => {
    if (defaultClient) {
      form.setValue('client_name', defaultClient.name);
      form.setValue('client_email', defaultClient.email);
      
      // Set client mode to existing when defaultClient is provided
      setClientMode('existing');
      
      // Find the matching client ID from existing clients
      if (existingClients.length > 0) {
        const matchingClient = existingClients.find(client => 
          (client.decrypted_email || client.email) === defaultClient.email
        );
        if (matchingClient) {
          setSelectedClientId(matchingClient.id);
        }
      }
    }
  }, [defaultClient, form, existingClients]);

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

      // Decrypt client data
      const clientsWithDecryption = await Promise.all(
        (clients || []).map(async (client) => ({
          ...client,
          decrypted_name: await decryptSingleValue(client.name),
          decrypted_email: await decryptSingleValue(client.email)
        }))
      );

      setExistingClients(clientsWithDecryption);
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

  const generateGoogleCalendarUrl = (appointmentData: FormValues) => {
    const [hours, minutes] = appointmentData.session_time.split(":");
    const startDate = new Date(appointmentData.session_date);
    startDate.setHours(parseInt(hours), parseInt(minutes));
    
    const endDate = new Date(startDate.getTime() + parseInt(appointmentData.session_length) * 60 * 1000);
    
    // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
    const formatDateForGoogle = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    
    const title = `TheraSuite Appointment with ${appointmentData.client_name}`;
    const startTime = formatDateForGoogle(startDate);
    const endTime = formatDateForGoogle(endDate);
    
    let description = `Session Type: ${appointmentData.session_type === 'video' ? 'Video Call' : 'In Person'}\n`;
    description += `Duration: ${appointmentData.session_length} minutes\n`;
    
    if (appointmentData.session_type === 'video') {
      if (appointmentData.video_provider === 'therasuite') {
        description += `Video Platform: TheraSuite Video`;
      } else {
        description += `Video Platform: ${appointmentData.video_provider === 'google_meet' ? 'Google Meet' : 'Zoom'}`;
      }
    }
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${startTime}/${endTime}`,
      details: description,
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handleAddToCalendar = () => {
    if (createdAppointmentData) {
      const calendarUrl = generateGoogleCalendarUrl(createdAppointmentData);
      window.open(calendarUrl, '_blank');
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessOverlay(false);
    setCreatedAppointmentData(null);
    setEmailWarning(false);
    onOpenChange(false);
    form.reset();
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setIsCreatingMultiple(values.is_recurring);
    setFormError(null);
    setShowSuccessOverlay(false);
    setEmailWarning(false);
    let successCount = 0;

    try {
      const [hours, minutes] = values.session_time.split(":");
      let session_date = new Date(values.session_date);
      session_date.setHours(parseInt(hours), parseInt(minutes));
      
      if (session_date < new Date()) {
        setFormError("Cannot schedule an appointment in the past");
        setIsSubmitting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFormError("You must be logged in to create appointments");
        setIsSubmitting(false);
        return;
      }

      // If recurring, create multiple appointments
      const appointmentsToCreate = values.is_recurring ? values.number_of_sessions! : 1;
      let currentSessionDate = new Date(session_date);

      for (let i = 0; i < appointmentsToCreate; i++) {
        // Start Overlap Check
        const newAppointmentStart = new Date(currentSessionDate);
        const newAppointmentEnd = new Date(newAppointmentStart.getTime() + parseInt(values.session_length) * 60 * 1000);

        // Fetch existing appointments for the therapist on the same day
        const startOfDay = new Date(currentSessionDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(currentSessionDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: existingAppointments, error: fetchError } = await supabase
          .from('appointments')
          .select('session_date, session_length')
          .eq('therapist_id', user.id)
          .gte('session_date', startOfDay.toISOString())
          .lte('session_date', endOfDay.toISOString())
          .in('status', ['scheduled']); // Only check against scheduled appointments

        if (fetchError) {
          console.error("Error fetching existing appointments:", fetchError);
          setFormError("Could not verify availability. Please try again.");
          setIsSubmitting(false);
          return;
        }

        if (existingAppointments) {
          // Explicitly cast each item in the loop
          for (const existingRaw of existingAppointments) {
            const existing = existingRaw as ExistingAppointmentData;
            const existingStart = new Date(existing.session_date);
            // Use the correctly typed existing.session_length (number)
            const existingEnd = new Date(existingStart.getTime() + existing.session_length * 60 * 1000);

            // Check for overlap: (StartA < EndB) and (EndA > StartB)
            if (newAppointmentStart < existingEnd && newAppointmentEnd > existingStart) {
              const formattedDate = format(newAppointmentStart, 'PPP');
              const formattedTime = format(newAppointmentStart, 'p');
              setFormError(`You already have another appointment booked for ${formattedDate} at ${formattedTime}. Please select a different date/time.`);
              setIsSubmitting(false);
              setIsCreatingMultiple(false);
              setCreatedCount(0);
              return;
            }
          }
        }

        // Handle client creation/selection
        let client;
        if ((clientMode === 'existing' && selectedClientId) || (disableClientFields && selectedClientId)) {
          // Use existing client
          const existingClient = existingClients.find(c => c.id === selectedClientId);
          if (!existingClient) {
            throw new Error('Selected client not found');
          }
          client = existingClient;
        } else if (disableClientFields) {
          // If client fields are disabled but no selectedClientId, find by email
          const matchingClient = existingClients.find(client => 
            (client.decrypted_email || client.email) === values.client_email
          );
          if (matchingClient) {
            client = matchingClient;
          } else {
            throw new Error('Client not found in existing clients list');
          }
        } else {
          // Create new client - encrypt client data first
          const encryptedData = await encryptClientData({
            name: values.client_name,
            email: values.client_email
          });

          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .upsert({
              therapist_id: user.id,
              name: encryptedData.name,
              email: encryptedData.email,
              avatar_color: generateRandomColor(),
              initials: getInitials(values.client_name),
            } as Database['public']['Tables']['clients']['Insert'], {
              onConflict: 'therapist_id,email'
            })
            .select()
            .single();

          if (clientError) throw clientError;
          client = newClient;
        }

        // Encrypt client data for appointment record too
        const appointmentClientData = await encryptClientData({
          name: values.client_name,
          email: values.client_email
        });

        const appointmentData: Database['public']['Tables']['appointments']['Insert'] = {
          therapist_id: user.id,
          client_id: client.id,
          client_name: appointmentClientData.name,
          client_email: appointmentClientData.email,
          session_date: currentSessionDate.toISOString(),
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
                clientId: client.id,
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
                session_date: currentSessionDate.toISOString(),
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
          // Don't throw here, just log the email error
          // We'll still show success since appointment was created
          setEmailWarning(true);
        }

        successCount++;
        setCreatedCount(successCount);

        // If recurring, calculate next date based on frequency
        if (values.is_recurring) {
          const frequency = values.recurring_frequency;
          if (frequency === 'weekly') {
            // Add 7 days for weekly
            currentSessionDate = new Date(currentSessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else if (frequency === 'biweekly') {
            // Add 14 days for biweekly
            currentSessionDate = new Date(currentSessionDate.getTime() + 14 * 24 * 60 * 60 * 1000);
          } else if (frequency === 'monthly') {
            // Add 1 month for monthly
            const nextMonth = new Date(currentSessionDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            currentSessionDate = nextMonth;
          } else if (frequency === 'bimonthly') {
            // Add 2 months for bi-monthly
            const nextBiMonth = new Date(currentSessionDate);
            nextBiMonth.setMonth(nextBiMonth.getMonth() + 2);
            currentSessionDate = nextBiMonth;
          }
        }
      }

      // Show success overlay for single appointments
      if (!values.is_recurring) {
        setShowSuccessOverlay(true);
        setCreatedAppointmentData(values);
        onAppointmentCreated?.();
      } else {
        toast({
          title: "Success",
          description: `${successCount} appointments created successfully`,
        });
        onAppointmentCreated?.();
        onOpenChange(false);
        form.reset();
      }
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
      form.setValue('client_name', selectedClient.decrypted_name || selectedClient.name);
      form.setValue('client_email', selectedClient.decrypted_email || selectedClient.email);
      setSelectedClientId(clientId);
    }
  };

  // Update the useEffect that watches is_recurring to handle video provider
  useEffect(() => {
    if (form.watch('is_recurring')) {
      // Force video provider to TheraSuite when recurring is enabled
      form.setValue('video_provider', 'therasuite');
    }
  }, [form.watch('is_recurring')]);

  const formProps = {
    form,
    onSubmit,
    formError,
    isSubmitting,
    isCreatingMultiple,
    createdCount,
    showSuccessOverlay,
    emailWarning,
    clientMode,
    setClientMode,
    existingClients,
    selectedClientId,
    handleClientSelection,
    disableClientFields,
    isRecurring,
    currency,
    createdAppointmentData,
    handleAddToCalendar,
    handleCloseSuccessModal,
  };

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] md:max-w-[800px] my-4">
          <DialogHeader>
            <DialogTitle className="mb-4">Create New Appointment</DialogTitle>
          </DialogHeader>
          <CreateAppointmentForm {...formProps} />
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              onClick={form.handleSubmit(onSubmit)}
            >
              Create Appointment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Create New Appointment</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto flex-1">
          <CreateAppointmentForm {...formProps} className="pb-4" />
        </div>
        <DrawerFooter className="pt-2">
          <Button 
            type="submit" 
            disabled={isSubmitting}
            onClick={form.handleSubmit(onSubmit)}
          >
            Create Appointment
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
} 