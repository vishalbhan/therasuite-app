import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from '@/integrations/supabase/client';
import { createAppointmentRequest, getTherapistByUsername } from '@/lib/appointment-requests';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, User, Mail, MessageSquare, CalendarDays, Plus, X, CheckCircle, Clock8 } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/types/database.types';
import { LoadingScreen } from '@/components/ui/loading-screen';

type TherapistProfile = Database['public']['Tables']['profiles']['Row'];

const bookingSchema = z.object({
  client_name: z.string().min(2, "Name must be at least 2 characters"),
  client_email: z.string().email("Please enter a valid email address"),
  client_message: z.string().optional(),
  preferred_slots: z.array(z.object({
    date: z.date({
      required_error: "Please select a preferred date",
    }),
    time: z.string().min(1, "Please select a preferred time"),
    duration: z.string().min(1, "Please select session duration"),
  })).min(1, "Please add at least one preferred date and time"),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export default function PublicBooking() {
  const { username } = useParams<{ username: string }>();
  const [therapist, setTherapist] = useState<TherapistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      client_name: '',
      client_email: '',
      client_message: '',
      preferred_slots: [{
        date: undefined,
        time: '10:00',
        duration: '',
      }],
    },
  });

  useEffect(() => {
    const fetchTherapist = async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const therapistData = await getTherapistByUsername(username);
        if (therapistData) {
          setTherapist(therapistData);
          
          // Set default session duration based on therapist's preference
          if (therapistData.session_length) {
            form.setValue('preferred_slots.0.duration', therapistData.session_length.toString());
          }
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error('Error fetching therapist:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchTherapist();
  }, [username, form]);

  const onSubmit = async (values: BookingFormValues) => {
    if (!therapist) return;

    try {
      setSubmitting(true);
      
      // Convert all preferred slots to datetime strings
      const preferredDates = values.preferred_slots.map(slot => {
        const [hours, minutes] = slot.time.split(':');
        const dateTime = new Date(slot.date);
        dateTime.setHours(parseInt(hours), parseInt(minutes));
        return dateTime.toISOString();
      });
      
      // Use the first slot's duration (assuming all slots have same duration for now)
      const sessionLength = parseInt(values.preferred_slots[0].duration);
      
      await createAppointmentRequest({
        therapistId: therapist.id,
        clientName: values.client_name,
        clientEmail: values.client_email,
        clientMessage: values.client_message,
        preferredDates: preferredDates,
        sessionLength: sessionLength,
      });


      setShowSuccess(true);
      // Don't reset the form, just show success state
    } catch (error) {
      console.error('Error submitting booking request:', error);
      toast.error("Failed to send booking request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (notFound) {
    return <Navigate to="/404" replace />;
  }

  if (!therapist) {
    return <Navigate to="/404" replace />;
  }

  // Show success page
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="mb-8">
            <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-6" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Request Sent Successfully!
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Your booking request has been sent to {therapist.full_name}.
          </p>
          <p className="text-lg text-gray-500 mb-8">
            You'll hear back from the therapist soon via email.
          </p>
          <Button
            onClick={() => {
              setShowSuccess(false);
              form.reset({
                client_name: '',
                client_email: '',
                client_message: '',
                preferred_slots: [{
                  date: undefined,
                  time: '10:00',
                  duration: therapist?.session_length?.toString() || '',
                }],
              });
            }}
            variant="outline"
            size="lg"
          >
            Send Another Request
          </Button>
        </div>
      </div>
    );
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLocation = (location: any) => {
    if (!location) return null;
    if (typeof location === 'string') return location;
    if (typeof location === 'object') {
      const { city, state, country } = location;
      return [city, state, country].filter(Boolean).join(', ');
    }
    return null;
  };


  // Generate session duration options
  const generateDurationOptions = () => {
    const durations = [30, 45, 60, 90, 120];
    return durations.map(duration => ({
      value: duration.toString(),
      label: `${duration} minutes`
    }));
  };

  const durationOptions = generateDurationOptions();

  const addTimeSlot = () => {
    const currentSlots = form.getValues('preferred_slots');
    const lastSlot = currentSlots[currentSlots.length - 1];
    form.setValue('preferred_slots', [
      ...currentSlots,
      {
        date: undefined,
        time: '10:00',
        duration: lastSlot?.duration || (therapist?.session_length?.toString() || ''),
      }
    ]);
  };

  const removeTimeSlot = (index: number) => {
    const currentSlots = form.getValues('preferred_slots');
    if (currentSlots.length > 1) {
      form.setValue('preferred_slots', currentSlots.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* TheraSuite Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-violet-800">TheraSuite</h1>
        </div>
        
        {/* Therapist Profile Card */}
        <Card className="mb-8 bg-violet-100 shadow-md">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={therapist.photo_url || undefined} alt={therapist.full_name || 'Therapist'} />
                <AvatarFallback className="text-lg">
                  {getInitials(therapist.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">{therapist.full_name || 'Professional'}</CardTitle>
                <CardDescription className="mt-1">
                  {therapist.professional_type.charAt(0).toUpperCase() + therapist.professional_type.slice(1) || 'Therapist'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Booking Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Details Section */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
                <CardDescription>
                  Tell us a bit about yourself
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>Full Name *</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
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
                        <FormLabel className="flex items-center space-x-2">
                          <Mail className="h-4 w-4" />
                          <span>Email Address *</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter your email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="client_message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>Message (Optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell the therapist a bit about what you're looking for or any specific concerns..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This helps the therapist understand your needs better.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Preferred Date & Time Section */}
            <Card>
              <CardHeader>
                <CardTitle>Preferred Date & Time</CardTitle>
                <CardDescription>
                  Select your preferred appointment times. You can add multiple options to increase your chances of getting scheduled.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {form.watch('preferred_slots').map((_, index) => (
                  <div key={index} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">
                        Option {index + 1}
                      </h4>
                      {form.watch('preferred_slots').length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTimeSlot(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`preferred_slots.${index}.date`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center space-x-2">
                              <CalendarDays className="h-4 w-4" />
                              <span>Date *</span>
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-white border shadow-lg" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    isBefore(date, startOfDay(new Date())) || 
                                    date > addDays(new Date(), 90)
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`preferred_slots.${index}.time`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span>Time *</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                                  <Clock8 className="h-4 w-4" />
                                  <span className="sr-only">Time</span>
                                </div>
                                <Input
                                  type="time"
                                  {...field}
                                  className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                                  placeholder="Select time"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`preferred_slots.${index}.duration`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span>Duration *</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white border shadow-lg">
                                {durationOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {index < form.watch('preferred_slots').length - 1 && (
                      <div className="border-b border-gray-200 pb-4"></div>
                    )}
                  </div>
                ))}

                {/* Add Time Slot Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTimeSlot}
                  className="w-full border-dashed border-2 py-6 text-gray-600 hover:text-gray-800 hover:border-gray-400"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Another Time Option
                </Button>

                {/* Submit Button */}
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? "Sending Request..." : "Send Booking Request"}
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}
