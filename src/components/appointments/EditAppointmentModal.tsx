import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Input } from "@/components/ui/input";
import { Database } from "@/types/database.types";

const formSchema = z.object({
  session_date: z.date({
    required_error: "Please select a new session date",
    invalid_type_error: "Invalid date format",
  }),
  session_time: z.string({
    required_error: "Please select a session time",
  }).regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time in HH:MM format"),
  session_length: z.enum(["30", "60", "90", "120"], {
    errorMap: () => ({ message: "Please select a valid session length (30, 60, 90, or 120 minutes)" })
  }),
  notes: z.string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .optional()
    .transform(val => val || ""), // Transform empty string to null
});

type FormValues = z.infer<typeof formSchema>;

interface EditAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    session_date: string;
    session_length: number;
    notes?: string;
  } | null;
  onSuccess?: () => void;
}

export function EditAppointmentModal({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: EditAppointmentModalProps) {
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null); // Clear any previous errors
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

      const updateData: Database['public']['Tables']['appointments']['Update'] = {
        session_date: session_date.toISOString(),
        session_length: parseInt(values.session_length),
        notes: values.notes,
      };

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id);

      if (error) {
        console.error('Update error:', error);
        throw new Error(error.message || "Failed to update appointment");
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
        </DialogHeader>
        {formError && (
          <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md mb-4">
            {formError}
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 