import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { PhotoUpload } from '@/components/onboarding/PhotoUpload';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Power, Key, CheckCircle, XCircle, CalendarDays, X } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { Database } from '@/types/database.types';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, isBefore, startOfDay } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from '@/contexts/CurrencyContext';
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  DrawerDescription,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { PushNotificationSettings } from '@/components/notifications/PushNotificationSettings';

// Update the formSchema to handle the initial state better
const formSchema = z.object({
  photo_url: z.string().nullable(),
  full_name: z.string().nullable(),
  phone_number: z.string().nullable(),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores")
    .nullable(),
  professional_type: z.enum(['psychologist', 'therapist', 'coach']).nullable(),
  session_type: z.enum(['video', 'in_person', 'hybrid']).nullable(),
  currency: z.string(),
  payment_details: z.string().nullable(),
  location: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postal_code: z.string().optional()
  }).nullable(),
}).partial(); // Make all fields optional

// Password update schema
const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Update type definition
type FormValues = z.infer<typeof formSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function Settings() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<{
    available: boolean;
    message: string;
  } | null>(null);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [holidayPopoverOpen, setHolidayPopoverOpen] = useState(false);
  const [pendingHolidayDates, setPendingHolidayDates] = useState<Date[]>([]);
  const [removedHolidayDates, setRemovedHolidayDates] = useState<string[]>([]);
  const [isSavingHolidays, setIsSavingHolidays] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photo_url: null,
      full_name: '',
      phone_number: '',
      username: '',
      professional_type: null,
      session_type: null,
      currency: 'INR',
      payment_details: '',
      location: null,
    },
    mode: 'onSubmit', // Change from onChange to onSubmit
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const { setCurrency: setGlobalCurrency } = useCurrency();

  const checkUsernameAvailability = async () => {
    const currentUsername = form.getValues('username');
    
    if (!currentUsername || currentUsername.trim() === '') {
      setUsernameAvailability({
        available: false,
        message: 'Please enter a username to check availability'
      });
      return;
    }

    if (currentUsername.length < 3) {
      setUsernameAvailability({
        available: false,
        message: 'Username must be at least 3 characters'
      });
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(currentUsername)) {
      setUsernameAvailability({
        available: false,
        message: 'Username can only contain letters, numbers, hyphens, and underscores'
      });
      return;
    }

    try {
      setIsCheckingUsername(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setUsernameAvailability({
          available: false,
          message: 'Please sign in to check availability'
        });
        return;
      }

      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', currentUsername.toLowerCase())
        .neq('id', session.user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        setUsernameAvailability({
          available: false,
          message: 'Error checking username availability'
        });
        return;
      }

      if (existingUser) {
        setUsernameAvailability({
          available: false,
          message: 'Username is already taken'
        });
      } else {
        setUsernameAvailability({
          available: true,
          message: 'Username is available!'
        });
      }
    } catch (error) {
      setUsernameAvailability({
        available: false,
        message: 'Error checking username availability'
      });
    } finally {
      setIsCheckingUsername(false);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        
        // Ensure all required fields have default values
        const formData = {
          photo_url: profile.photo_url ?? null,
          full_name: profile.full_name ?? '',
          phone_number: profile.phone_number ?? '',
          username: profile.username ?? '',
          professional_type: profile.professional_type ?? null,
          session_type: profile.session_type ?? null,
          currency: profile.currency ?? 'INR',
          payment_details: profile.payment_details ?? '',
          location: profile.location ?? null,
        };

        form.reset(formData);

        const profileHolidays = (profile as any).holidays;
        if (Array.isArray(profileHolidays)) {
          setHolidays(profileHolidays.sort());
        }
      } catch (error) {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [form, navigate]);

  const updateHolidaysInDb = async (newHolidays: string[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { error } = await (supabase as any)
      .from('profiles')
      .update({ holidays: newHolidays })
      .eq('id', session.user.id);

    return !error;
  };

  const confirmHolidays = async () => {
    if (pendingHolidayDates.length === 0 && removedHolidayDates.length === 0) return;

    setIsSavingHolidays(true);
    const addedStrings = pendingHolidayDates.map(d => format(d, 'yyyy-MM-dd'));
    const removedSet = new Set(removedHolidayDates);
    const updated = [
      ...holidays.filter(h => !removedSet.has(h)),
      ...addedStrings,
    ].sort();
    const success = await updateHolidaysInDb(updated);

    if (success) {
      setHolidays(updated);
      setPendingHolidayDates([]);
      setRemovedHolidayDates([]);
      setHolidayPopoverOpen(false);

      const parts: string[] = [];
      if (addedStrings.length > 0) parts.push(`${addedStrings.length} added`);
      if (removedHolidayDates.length > 0) parts.push(`${removedHolidayDates.length} removed`);
      toast.success(`Holidays updated (${parts.join(', ')})`);
    } else {
      toast.error('Failed to update holidays');
    }
    setIsSavingHolidays(false);
  };

  // Clear username availability when username changes
  useEffect(() => {
    setUsernameAvailability(null);
  }, [form.watch('username')]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSaving(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        toast.error("Authentication error. Please try signing in again.");
        return;
      }
      
      if (!session) {
        toast.error("No active session. Please sign in again.");
        navigate('/');
        return;
      }

      // Check username uniqueness if username is being updated
      if (values.username && values.username.trim() !== '') {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', values.username.toLowerCase())
          .neq('id', session.user.id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
          toast.error("Error checking username availability");
          return;
        }

        if (existingUser) {
          toast.error("Username is already taken. Please choose a different one.");
          return;
        }
      }

      // Create update object based on session type
      const updateData = {
        photo_url: values.photo_url,
        full_name: values.full_name,
        phone_number: values.phone_number,
        username: values.username?.toLowerCase() || null,
        professional_type: values.professional_type,
        session_type: values.session_type,
        currency: values.currency,
        payment_details: values.payment_details,
        ...(values.session_type === 'video' ? {} : { location: values.location }),
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', session.user.id);

      if (updateError) {
        if (updateError.code === '23505') {
          toast.error("A conflict occurred while saving. Please try again.");
        } else if (updateError.code === 'PGRST116') {
          toast.error("You don't have permission to update this profile.");
        } else {
          toast.error(`Failed to save settings: ${updateError.message}`);
        }
        return;
      }

      setGlobalCurrency(values.currency);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("An unexpected error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const handlePasswordUpdate = async (values: PasswordFormValues) => {
    try {
      setIsUpdatingPassword(true);
      
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword
      });

      if (error) {
        toast.error(`Failed to update password: ${error.message}`);
        return;
      }

      toast.success("Password updated successfully");
      setShowPasswordModal(false);
      passwordForm.reset();
    } catch (error) {
      toast.error("An unexpected error occurred while updating password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-3xl font-bold">Settings</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPasswordModal(true)}
              className="gap-2"
            >
              <Key className="h-4 w-4" />
              Update Password
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSignOutModal(true)}
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
            >
              <Power className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
          {/* Profile Section */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">Profile Information</h2>
              <p className="text-muted-foreground">
                Update your personal information and profile photo
              </p>
            </div>
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="photo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Photo</FormLabel>
                    <PhotoUpload onChange={field.onChange} value={field.value} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="Enter your username" 
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                          className="flex-1"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={checkUsernameAvailability}
                        disabled={isCheckingUsername || !field.value?.trim()}
                        className="whitespace-nowrap"
                      >
                        {isCheckingUsername ? 'Checking...' : 'Check Availability'}
                      </Button>
                    </div>
                    {usernameAvailability && (
                      <div className={`flex items-center gap-2 text-sm ${
                        usernameAvailability.available ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {usernameAvailability.available ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span>{usernameAvailability.message}</span>
                      </div>
                    )}
                    <FormDescription>
                      Your unique username for your public booking page: therasuite.app/{field.value || 'your-username'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator className="my-8" />

          {/* Professional Information */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">Professional Details</h2>
              <p className="text-muted-foreground">
                Configure your professional role and availability
              </p>
            </div>
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="professional_type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Professional Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="psychologist" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Psychologist
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="therapist" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Therapist
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="coach" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Coach
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator className="my-8" />

          {/* Session Settings */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">Session Preferences</h2>
              <p className="text-muted-foreground">
                Manage your session delivery method
              </p>
            </div>
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="session_type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Session Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="video" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Video Only
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="in_person" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            In-Person Only
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="hybrid" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Hybrid (Both)
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator className="my-8" />

          {/* Replace Payment Settings with Currency Settings */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">Currency Settings</h2>
              <p className="text-muted-foreground">
                Select your preferred currency for transactions
              </p>
            </div>
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                      <SelectItem value="USD">US Dollar ($)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                      <SelectItem value="GBP">British Pound (£)</SelectItem>
                      <SelectItem value="AUD">Australian Dollar (A$)</SelectItem>
                      <SelectItem value="CAD">Canadian Dollar (C$)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Details</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      placeholder="Enter your payment details (e.g., UPI ID, bank account information, payment instructions)"
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormDescription>
                    These details will be shared with clients for payment processing
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {(form.watch('session_type') === 'in_person' || 
           form.watch('session_type') === 'hybrid') && (
            <>
              <Separator className="my-8" />
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-semibold">Practice Location</h2>
                  <p className="text-muted-foreground">
                    Enter the address where you conduct in-person sessions
                  </p>
                </div>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="location.address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const newLocation = { ...form.getValues('location'), address: e.target.value };
                              form.setValue('location', newLocation);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="location.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const newLocation = { ...form.getValues('location'), city: e.target.value };
                                form.setValue('location', newLocation);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location.state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const newLocation = { ...form.getValues('location'), state: e.target.value };
                                form.setValue('location', newLocation);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="location.postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const newLocation = { ...form.getValues('location'), postal_code: e.target.value };
                                form.setValue('location', newLocation);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const newLocation = { ...form.getValues('location'), country: e.target.value };
                                form.setValue('location', newLocation);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <PushNotificationSettings />

          <Separator className="my-8" />

          {/* Holidays Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Holidays</h2>
              <p className="text-muted-foreground">
                Select dates when you prefer not to have any meetings
              </p>
            </div>
            <div className="space-y-4">
              <Popover open={holidayPopoverOpen} onOpenChange={(open) => {
                setHolidayPopoverOpen(open);
                if (!open) {
                  setPendingHolidayDates([]);
                  setRemovedHolidayDates([]);
                }
              }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Add Holiday Dates
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border shadow-lg" align="start">
                  <CalendarComponent
                    mode="multiple"
                    selected={[
                      ...holidays
                        .filter(h => !removedHolidayDates.includes(h))
                        .map(h => new Date(h + 'T00:00:00')),
                      ...pendingHolidayDates,
                    ]}
                    onSelect={(dates) => {
                      const selectedStrings = new Set(
                        (dates || []).map(d => format(d, 'yyyy-MM-dd'))
                      );
                      const existingSet = new Set(holidays);

                      const newAdded = (dates || []).filter(
                        d => !existingSet.has(format(d, 'yyyy-MM-dd'))
                      );
                      setPendingHolidayDates(newAdded);

                      const nowRemoved = holidays.filter(h => !selectedStrings.has(h));
                      setRemovedHolidayDates(nowRemoved);
                    }}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    initialFocus
                  />
                  <div className="p-3 border-t flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {pendingHolidayDates.length > 0 && `+${pendingHolidayDates.length}`}
                      {pendingHolidayDates.length > 0 && removedHolidayDates.length > 0 && ', '}
                      {removedHolidayDates.length > 0 && `-${removedHolidayDates.length}`}
                      {pendingHolidayDates.length === 0 && removedHolidayDates.length === 0 && 'No changes'}
                    </span>
                    <Button
                      size="sm"
                      onClick={confirmHolidays}
                      disabled={(pendingHolidayDates.length === 0 && removedHolidayDates.length === 0) || isSavingHolidays}
                    >
                      {isSavingHolidays ? 'Saving...' : 'Confirm'}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {holidays.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const groups: string[][] = [];
                    const sorted = [...holidays].sort();
                    let current: string[] = [sorted[0]];

                    for (let i = 1; i < sorted.length; i++) {
                      const prev = new Date(sorted[i - 1] + 'T00:00:00');
                      const curr = new Date(sorted[i] + 'T00:00:00');
                      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
                      if (diffDays === 1) {
                        current.push(sorted[i]);
                      } else {
                        groups.push(current);
                        current = [sorted[i]];
                      }
                    }
                    groups.push(current);

                    return groups.map((group) => {
                      const firstDate = new Date(group[0] + 'T00:00:00');
                      const lastDate = new Date(group[group.length - 1] + 'T00:00:00');
                      const label = group.length === 1
                        ? format(firstDate, 'MMM d')
                        : `${format(firstDate, 'MMM d')} – ${format(lastDate, 'MMM d')}`;

                      return (
                        <span
                          key={group[0]}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={async () => {
                              const newHolidays = holidays.filter(h => !group.includes(h));
                              const success = await updateHolidaysInDb(newHolidays);
                              if (success) {
                                setHolidays(newHolidays);
                                toast.success(group.length === 1 ? 'Holiday removed' : `${group.length} holidays removed`);
                              } else {
                                toast.error('Failed to remove holiday');
                              }
                            }}
                            className="ml-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No holidays added yet. Add dates when you'd like to block appointments.
                </p>
              )}
            </div>
          </div>

          <Separator className="my-8" />

          <Button 
            type="submit" 
            className="w-full"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-sm mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </form>
      </Form>

      <ConfirmModal
        open={showSignOutModal}
        onOpenChange={setShowSignOutModal}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmText="Yes, sign out"
        cancelText="No, stay signed in"
        onConfirm={handleSignOut}
      />

      {!isMobile ? (
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update Password</DialogTitle>
              <DialogDescription>
                Enter your new password below. Make sure it's at least 6 characters long.
              </DialogDescription>
            </DialogHeader>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordModal(false);
                      passwordForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? (
                      <>
                        <span className="loading loading-spinner loading-sm mr-2" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Update Password</DrawerTitle>
              <DrawerDescription>
                Enter your new password below. Make sure it's at least 6 characters long.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter new password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirm new password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </div>
            <DrawerFooter className="pt-2">
              <Button 
                type="submit" 
                disabled={isUpdatingPassword}
                onClick={passwordForm.handleSubmit(handlePasswordUpdate)}
              >
                {isUpdatingPassword ? (
                  <>
                    <span className="loading loading-spinner loading-sm mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordModal(false);
                    passwordForm.reset();
                  }}
                >
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
} 