import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { decryptSingleValue } from "@/lib/encryption";

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

// Content component to be used in both Dialog and Drawer
function AppointmentDetailsContent({ 
  appointment, 
  decryptedClientName, 
  actions,
  className 
}: { 
  appointment: Appointment; 
  decryptedClientName: string; 
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="space-y-4">
        <div>
          <h3 className="font-medium">Client</h3>
          <p className="text-gray-600">{decryptedClientName || appointment.client_name}</p>
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
              appointment.status === 'completed' ? 'secondary' :
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
    </div>
  );
}

export function AppointmentDetailsModal({
  appointment,
  open,
  onOpenChange,
  actions
}: AppointmentDetailsModalProps) {
  const isMobile = useIsMobile();
  const [decryptedClientName, setDecryptedClientName] = useState<string>('');

  useEffect(() => {
    const decryptClientName = async () => {
      if (appointment?.client_name) {
        try {
          const decrypted = await decryptSingleValue(appointment.client_name);
          setDecryptedClientName(decrypted);
        } catch (error) {
          console.error('Error decrypting client name:', error);
          // Fallback to original value if decryption fails
          setDecryptedClientName(appointment.client_name);
        }
      }
    };

    if (appointment) {
      decryptClientName();
    }
  }, [appointment]);

  if (!appointment) return null;

  const contentProps = {
    appointment,
    decryptedClientName,
    actions,
  };

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          <AppointmentDetailsContent {...contentProps} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Appointment Details</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <AppointmentDetailsContent {...contentProps} />
        </div>
      </DrawerContent>
    </Drawer>
  );
} 