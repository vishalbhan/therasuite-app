import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { WorkingHoursInput } from '@/components/onboarding/WorkingHoursInput';
import { PhotoUpload } from '@/components/onboarding/PhotoUpload';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Power } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { Database } from '@/types/database.types';
import { TimeSlot } from '@/components/onboarding/WorkingHoursInput';

// Update the form schema to match database types
const formSchema = z.object({
  photo_url: z.string().optional().nullable(),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  professional_type: z.enum(['psychologist', 'therapist', 'coach']),
  working_hours: z.record(z.string(), z.array(z.object({
    start: z.string(),
    end: z.string(),
    enabled: z.boolean()
  }).required())).nullable(),
  session_length: z.number().min(30).max(180),
  session_type: z.enum(['video', 'in_person', 'hybrid']),
  collect_payments: z.boolean(),
  price_per_session: z.union([z.string(), z.number()]).optional().nullable(),
  payment_details: z.string().optional().nullable(),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postal_code: z.string()
  }).optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

// This ensures the working_hours type matches exactly what WorkingHoursInput expects
type WorkingHours = Record<string, TimeSlot[]>;

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      collect_payments: false,
      photo_url: null,
      payment_details: '',
      price_per_session: null,
      location: null,
    }
  });

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
        
        // Only reset form with non-null values from profile
        const formData = Object.entries(profile).reduce((acc, [key, value]) => {
          if (value !== null) {
            acc[key] = value;
          }
          return acc;
        }, {} as Partial<FormValues>);

        form.reset(formData);
      } catch (error) {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [form, navigate]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const updateData = Object.entries(values).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Database['public']['Tables']['profiles']['Update']);

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button
          variant="destructive"
          onClick={() => setShowSignOutModal(true)}
          className="gap-2"
        >
          <Power className="h-4 w-4" />
          Sign Out
        </Button>
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

              <FormField
                control={form.control}
                name="working_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Working Hours</FormLabel>
                    <FormControl>
                      <WorkingHoursInput
                        value={field.value}
                        onChange={field.onChange}
                      />
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
                Manage your session settings and delivery method
              </p>
            </div>
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="session_length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Session Length (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={30}
                        max={180}
                        step={30}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

          {/* Payment Settings */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">Payment Settings</h2>
              <p className="text-muted-foreground">
                Configure your payment preferences and session pricing
              </p>
            </div>
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="collect_payments"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Collect Payments
                      </FormLabel>
                      <FormDescription>
                        Enable payment collection from clients
                      </FormDescription>
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

              {form.watch('collect_payments') && (
                <>
                  <FormField
                    control={form.control}
                    name="price_per_session"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price per Session ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="Enter amount"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
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
                          <Input
                            placeholder="Enter your payment details (e.g., bank account, PayPal)"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value || '')}
                          />
                        </FormControl>
                        <FormDescription>
                          These details will be shared with clients when sending invoices
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          </div>

          {(form.watch('session_type') === 'in_person' || 
           form.watch('session_type') === 'hybrid') && (
            <>
              <Separator className="my-8" />
              {/* Location Settings */}
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
                          <Input {...field} />
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
                            <Input {...field} />
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
                            <Input {...field} />
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
                            <Input {...field} />
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
                            <Input {...field} />
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
    </div>
  );
} 