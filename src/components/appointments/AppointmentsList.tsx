import { format, addMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock, Video, MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Appointment {
  id: string;
  client_name: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled';
  price: number;
}

interface AppointmentsListProps {
  appointments: Appointment[];
  selectedDate: Date;
}

export function AppointmentsList({ appointments, selectedDate }: AppointmentsListProps) {
  const formatTimeRange = (startTime: string, lengthInMinutes: number) => {
    const startDate = new Date(startTime);
    const endDate = addMinutes(startDate, lengthInMinutes);
    return `${format(startDate, "h:mm")} - ${format(endDate, "h:mm a")}`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <CalendarIcon className="h-5 w-5" />
        Appointments for {format(selectedDate, "MMMM d, yyyy")}
      </h2>
      
      {appointments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No appointments scheduled for this day.
        </p>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="border rounded-lg p-4 hover:shadow transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{appointment.client_name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="h-4 w-4" />
                    {formatTimeRange(appointment.session_date, appointment.session_length)} · {appointment.session_length} mins
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {appointment.session_type === 'video' ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    {appointment.session_type === 'video' ? 'Video Call' : 'In-Person'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {formatCurrency(appointment.price)}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs capitalize
                  ${appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : ''}
                  ${appointment.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                  ${appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                `}>
                  {appointment.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 