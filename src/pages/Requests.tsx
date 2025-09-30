import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppointmentRequestsList } from "@/components/appointments/AppointmentRequestsList";
import { getAppointmentRequestsForTherapist } from "@/lib/appointment-requests";
import { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Share } from "lucide-react";
import { toast } from "sonner";

type AppointmentRequest = Database['public']['Tables']['appointment_requests']['Row'];

export default function Requests() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        // Fetch the user's profile to get their username
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
          
        if (profile) {
          const profileData = profile as { username?: string | null };
          if (profileData.username) {
            setUsername(profileData.username);
          }
        }
      }
    };

    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchRequests();
    }
  }, [currentUserId]);

  const fetchRequests = async () => {
    if (!currentUserId) return;
    
    try {
      const data = await getAppointmentRequestsForTherapist(currentUserId);
      setRequests(data);
    } catch (error) {
      console.error('Error fetching appointment requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareBookingPage = async () => {
    if (!username) {
      toast.error('Username not found. Please set your username in Settings.');
      return;
    }
    
    const bookingUrl = `https://therasuite.app/${username}`;
    
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast.success('Booking page URL copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy URL to clipboard');
    }
  };

  return (
    <div className="container px-4 sm:px-6 mx-auto py-6 max-w-[95%] sm:max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Appointment Requests</h1>
            <p className="text-gray-600 mt-2">
              Review and manage appointment requests from your public booking page.
            </p>
          </div>
          <Button
            onClick={handleShareBookingPage}
            variant="outline"
            className="flex items-center space-x-2"
            disabled={!username}
          >
            <Share className="h-4 w-4" />
            <span>Share Booking Page</span>
          </Button>
        </div>
      </div>

      {currentUserId && (
        <AppointmentRequestsList therapistId={currentUserId} />
      )}
    </div>
  );
}
