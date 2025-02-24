import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
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

const formSchema = yup.object({
  full_name: yup.string().required("Full name is required"),
  photo_url: yup.string().nullable(),
  collect_payments: yup.boolean().default(false),
  payment_details: yup.string().when('collect_payments', {
    is: true,
    then: (schema) => schema.required('Payment details are required when collecting payments'),
    otherwise: (schema) => schema.optional()
  }),
  price_per_session: yup.number().nullable().when('collect_payments', {
    is: true,
    then: (schema) => schema.required('Price per session is required when collecting payments'),
    otherwise: (schema) => schema.optional()
  }),
  location: yup.string().nullable(),
  working_hours: yup.array().of(
    yup.object({
      day: yup.string().required(),
      start: yup.string().nullable(),
      end: yup.string().nullable(),
      isWorking: yup.boolean()
    })
  )
});

type FormValues = yup.InferType<typeof formSchema>;

const steps = ['Basic Info', 'Schedule', 'Session Details', 'Payment'];

interface WorkingHours {
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  hours: WorkingHours;
}

type WeekSchedule = {
  [key in DayOfWeek]: DaySchedule;
};

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const OnboardingForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sameHoursEveryDay, setSameHoursEveryDay] = useState(false);
  const [schedule, setSchedule] = useState<WeekSchedule>({
    monday: { enabled: true, hours: { start: "09:00", end: "17:00" } },
    tuesday: { enabled: true, hours: { start: "09:00", end: "17:00" } },
    wednesday: { enabled: true, hours: { start: "09:00", end: "17:00" } },
    thursday: { enabled: true, hours: { start: "09:00", end: "17:00" } },
    friday: { enabled: true, hours: { start: "09:00", end: "17:00" } },
    saturday: { enabled: false, hours: { start: "09:00", end: "17:00" } },
    sunday: { enabled: false, hours: { start: "09:00", end: "17:00" } },
  });

  const form = useForm<FormValues>({
    resolver: yupResolver(formSchema),
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
      // Transform schedule into working_hours format
      const working_hours = Object.entries(schedule).reduce((acc, [day, { enabled, hours }]) => ({
        ...acc,
        [day.charAt(0).toUpperCase() + day.slice(1)]: [
          {
            start: hours.start,
            end: hours.end,
            enabled: enabled
          }
        ]
      }), {});

      // Clean up the values before sending to Supabase
      const submitData = {
        ...values,
        working_hours,
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

  // Function to update all days with the same hours
  const updateAllDays = (hours: WorkingHours) => {
    const updatedSchedule = { ...schedule };
    Object.keys(updatedSchedule).forEach((day) => {
      if (updatedSchedule[day as DayOfWeek].enabled) {
        updatedSchedule[day as DayOfWeek].hours = hours;
      }
    });
    setSchedule(updatedSchedule);
  };

  // Function to update a single day's hours
  const updateDayHours = (day: DayOfWeek, hours: WorkingHours) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], hours },
    }));
  };

  // Function to toggle a day's enabled status
  const toggleDay = (day: DayOfWeek) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        hours: prev[day].hours,
      },
    }));
  };

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
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Working Hours</h2>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={sameHoursEveryDay}
                  onCheckedChange={setSameHoursEveryDay}
                  id="same-hours"
                />
                <Label htmlFor="same-hours">Same hours every day?</Label>
              </div>

              {sameHoursEveryDay ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label>Start Time</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={schedule.monday.hours.start}
                        onChange={(e) => updateAllDays({ 
                          start: e.target.value, 
                          end: schedule.monday.hours.end 
                        })}
                      >
                        {generateTimeOptions()}
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label>End Time</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={schedule.monday.hours.end}
                        onChange={(e) => updateAllDays({ 
                          start: schedule.monday.hours.start, 
                          end: e.target.value 
                        })}
                      >
                        {generateTimeOptions()}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(schedule).map(([day, { enabled }]) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleDay(day as DayOfWeek)}
                          id={`day-${day}`}
                        />
                        <Label htmlFor={`day-${day}`} className="capitalize">
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(schedule).map(([day, { enabled, hours }]) => (
                    <div key={day} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleDay(day as DayOfWeek)}
                          id={`day-${day}`}
                        />
                        <Label htmlFor={`day-${day}`} className="capitalize">
                          {day}
                        </Label>
                      </div>
                      
                      {enabled && (
                        <div className="flex items-center gap-4 ml-8">
                          <div className="flex-1">
                            <Label>Start Time</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={hours.start}
                              onChange={(e) => updateDayHours(day as DayOfWeek, {
                                start: e.target.value,
                                end: hours.end,
                              })}
                            >
                              {generateTimeOptions()}
                            </select>
                          </div>
                          <div className="flex-1">
                            <Label>End Time</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={hours.end}
                              onChange={(e) => updateDayHours(day as DayOfWeek, {
                                start: hours.start,
                                end: e.target.value,
                              })}
                            >
                              {generateTimeOptions()}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

// Helper function to generate time options (30-minute intervals)
function generateTimeOptions() {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push(
        <option key={time} value={time}>
          {format(parse(time, 'HH:mm', new Date()), 'h:mm a')}
        </option>
      );
    }
  }
  return options;
} 