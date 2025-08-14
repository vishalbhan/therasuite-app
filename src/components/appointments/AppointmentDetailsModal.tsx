import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Appointment {
  id: string;
  client_name: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface AppointmentDetailsModalProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: React.ReactNode;
}

export function AppointmentDetailsModal({
  appointment,
  open,
  onOpenChange,
  actions
}: AppointmentDetailsModalProps) {
  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appointment Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Client</h3>
            <p className="text-gray-600">{appointment.client_name}</p>
          </div>

          <div>
            <h3 className="font-medium">Date & Time</h3>
            <p className="text-gray-600">
              {format(new Date(appointment.session_date), "MMMM d, yyyy 'at' h:mm aa")}
            </p>
          </div>

          <div>
            <h3 className="font-medium">Duration</h3>
            <p className="text-gray-600">{appointment.session_length} minutes</p>
          </div>

          <div>
            <h3 className="font-medium">Session Type</h3>
            <Badge variant="outline" className="mt-1">
              {appointment.session_type === 'video' ? 'Video Call' : 'In Person'}
            </Badge>
          </div>

          <div>
            <h3 className="font-medium">Status</h3>
            <Badge 
              className="mt-1"
              variant={
                appointment.status === 'completed' ? 'success' :
                appointment.status === 'cancelled' ? 'destructive' : 'default'
              }
            >
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Badge>
          </div>
        </div>

        {actions && (
          <div className="flex justify-end mt-4 pt-4 border-t">
            {actions}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 