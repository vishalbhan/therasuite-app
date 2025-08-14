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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { WorkingHoursInput } from './WorkingHoursInput';
import { PhotoUpload } from './PhotoUpload';
import { Label } from '@/components/ui/label';
import { format, parse } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  photo_url: z.string().nullable(),
  professional_type: z.string().min(1, "Professional type is required"),
  session_type: z.enum(['video', 'in_person', 'hybrid']),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postal_code: z.string()
  }).nullable(),
  currency: z.string().min(1, "Currency is required"),
  email: z.string().email(),
});

type FormValues = z.infer<typeof formSchema>;

export const OnboardingForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photo_url: '',
      full_name: '',
      professional_type: 'therapist',
      session_type: 'video',
      location: null,
      currency: 'INR',
      email: '',
    }
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        form.setValue('email', user.email);
      }
    };
    getUser();
  }, [form]);

  useEffect(() => {
    const sessionType = form.watch('session_type');
    if (sessionType === 'video') {
      form.setValue('location', null);
    } else if (!form.getValues('location')) {
      form.setValue('location', {
        address: '',
        city: '',
        state: '',
        country: '',
        postal_code: ''
      });
    }
  }, [form.watch('session_type'), form]);

  const onSubmit = async (values: FormValues) => {
    console.log('Form submitted with values:', values);
    
    try {
      setIsSubmitting(true);
      console.log('Getting user...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('User data:', user, 'User error:', userError);
      
      if (userError || !user) {
        console.error('No user found:', userError);
        throw new Error('No authenticated user found');
      }

      const submitData = {
        ...values,
        location: values.session_type === 'video' ? null : values.location,
        is_onboarding_complete: true,
        id: user.id
      };

      console.log('Preparing to submit data:', submitData);

      const { data, error } = await supabase
        .from('profiles')
        .upsert(submitData, {
          onConflict: 'id'
        });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Profile updated successfully');

      toast({
        title: "Success",
        description: "Your profile has been completed successfully!",
      });
      
      console.log('Preparing to navigate...');
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error) {
      console.error('Error in form submission:', error);
      toast({
        title: "Error",
        description: "There was an error saving your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showLocationFields = form.watch('session_type') !== 'video';

  // Add this to debug form state
  console.log('Form state:', {
    values: form.getValues(),
    errors: form.formState.errors,
    isValid: form.formState.isValid
  });

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Form {...form}>
        <form 
          onSubmit={(e) => {
            console.log('Form submit event triggered');
            form.handleSubmit(onSubmit)(e);
          }} 
          className="space-y-6"
        >
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
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="professional_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Professional Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex gap-4"
                  >
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <RadioGroupItem value="psychologist" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Psychologist
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <RadioGroupItem value="therapist" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Therapist
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2">
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
            name="session_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex gap-4"
                  >
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <RadioGroupItem value="video" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Video Call
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <RadioGroupItem value="in_person" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        In-Person
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <RadioGroupItem value="hybrid" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Hybrid
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {showLocationFields && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="location.address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
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
                        <Input {...field} value={field.value || ''} />
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
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location.country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="location.postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select your currency</FormLabel>
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

          <div className="flex justify-end pt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="mr-2">Saving...</span>
                </>
              ) : (
                'Complete Profile'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}; 