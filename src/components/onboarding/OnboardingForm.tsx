import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

const formSchema = z.object({
  photo_url: z.string().optional(),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  professional_type: z.enum(['psychologist', 'therapist', 'coach']),
  working_hours: z.record(z.string(), z.array(z.object({
    start: z.string(),
    end: z.string(),
    enabled: z.boolean()
  }))).transform(hours => {
    return Object.fromEntries(
      Object.entries(hours).map(([day, slots]) => [
        day,
        slots.map(slot => ({
          start: slot.start,
          end: slot.end,
          enabled: slot.enabled
        }))
      ])
    );
  }),
  session_length: z.number().min(30).max(180),
  session_type: z.enum(['video', 'in_person', 'hybrid']),
  collect_payments: z.boolean(),
  price_per_session: z.union([
    z.string(),
    z.number()
  ]).optional().transform(val => {
    if (!val) return null;
    if (typeof val === 'string' && val === '') return null;
    return Number(val);
  }),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postal_code: z.string()
  }).optional().transform(val => {
    if (!val) return null;
    if (!val.address || !val.city || !val.state || !val.country || !val.postal_code) return null;
    return {
      address: val.address,
      city: val.city,
      state: val.state,
      country: val.country,
      postal_code: val.postal_code
    };
  })
});

type FormValues = z.infer<typeof formSchema>;

const steps = ['Basic Info', 'Schedule', 'Session Details', 'Payment'];

export const OnboardingForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photo_url: '',
      full_name: '',
      professional_type: 'therapist',
      working_hours: {
        Monday: [{ start: '09:00', end: '17:00', enabled: true }],
        Tuesday: [{ start: '09:00', end: '17:00', enabled: true }],
        Wednesday: [{ start: '09:00', end: '17:00', enabled: true }],
        Thursday: [{ start: '09:00', end: '17:00', enabled: true }],
        Friday: [{ start: '09:00', end: '17:00', enabled: true }],
        Saturday: [{ start: '09:00', end: '17:00', enabled: false }],
        Sunday: [{ start: '09:00', end: '17:00', enabled: false }],
      },
      session_length: 60,
      session_type: 'video',
      collect_payments: false,
      price_per_session: '',
      location: {
        address: '',
        city: '',
        state: '',
        country: '',
        postal_code: '',
      },
    }
  });

  const onSubmit = async (values: FormValues) => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }
    
    try {
      // Clean up the values before sending to Supabase
      const submitData = {
        ...values,
        price_per_session: values.collect_payments ? Number(values.price_per_session) : null,
        location: values.session_type === 'video' ? null : values.location,
        is_onboarding_complete: true,
        id: (await supabase.auth.getUser()).data.user?.id
      };

      console.log('Submitting data:', submitData); // Debug log

      const { error } = await supabase
        .from('profiles')
        .upsert(submitData);

      if (error) {
        console.error('Supabase error:', error); // Debug log
        throw error;
      }

      toast({
        title: "Success",
        description: "Your profile has been completed successfully!",
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "There was an error saving your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const showLocationFields = form.watch('session_type') !== 'video';
  const showPriceField = form.watch('collect_payments');

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`flex items-center ${
                index <= currentStep ? 'text-primary' : 'text-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
                    ${index <= currentStep ? 'border-primary' : 'border-gray-300'}`}
                >
                  {index + 1}
                </div>
                <span className="mt-2 text-sm">{step}</span>
              </div>
              {index < steps.length - 1 && (
                <Separator className="w-full mx-4" />
              )}
            </div>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {currentStep === 0 && (
            <>
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
            </>
          )}

          {currentStep === 1 && (
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
          )}

          {currentStep === 2 && (
            <>
              <FormField
                control={form.control}
                name="session_length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Length (minutes)</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value.toString()}
                        className="flex gap-4"
                      >
                        {[30, 45, 60, 90, 120].map((minutes) => (
                          <FormItem key={minutes} className="flex items-center space-x-2">
                            <FormControl>
                              <RadioGroupItem value={minutes.toString()} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {minutes} min
                            </FormLabel>
                          </FormItem>
                        ))}
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
                  </div>
                </div>
              )}
            </>
          )}

          {currentStep === 3 && (
            <>
              <FormField
                control={form.control}
                name="collect_payments"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Collect Payments Online</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Enable online payments for your sessions
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

              {showPriceField && (
                <FormField
                  control={form.control}
                  name="price_per_session"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Session</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2">$</span>
                          <Input
                            {...field}
                            type="number"
                            className="pl-7"
                            placeholder="0.00"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}

          <div className="flex justify-between pt-6">
            {currentStep > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                Previous
              </Button>
            )}
            <Button type="submit">
              {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}; 