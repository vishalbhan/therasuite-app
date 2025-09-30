import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Users, 
  FileText,
  Receipt,
  UserCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAppointmentRequestsForTherapist } from "@/lib/appointment-requests";

const bottomNavItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Requests",
    icon: UserCheck,
    href: "/requests",
  },
  {
    label: "Clients",
    icon: Users,
    href: "/clients",
  },
  {
    label: "Notes",
    icon: FileText,
    href: "/notes",
  },
  {
    label: "Invoices",
    icon: Receipt,
    href: "/invoices",
  },
];

export function BottomNavigation() {
  const location = useLocation();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };

    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchPendingRequestsCount();
      
      // Set up real-time subscription for appointment requests
      const channel = supabase
        .channel('appointment_requests_changes_bottom')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointment_requests',
            filter: `therapist_id=eq.${currentUserId}`
          },
          () => {
            fetchPendingRequestsCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUserId]);

  const fetchPendingRequestsCount = async () => {
    if (!currentUserId) return;
    
    try {
      const requests = await getAppointmentRequestsForTherapist(currentUserId);
      const pendingCount = requests.filter(r => r.status === 'pending').length;
      setPendingRequestsCount(pendingCount);
    } catch (error) {
      console.error('Error fetching pending requests count:', error);
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-5">
      <div className="flex items-center justify-around py-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          const showBadge = item.label === "Requests" && pendingRequestsCount > 0;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center px-3 py-2 text-xs font-medium transition-colors min-w-0 flex-1 relative
                ${isActive 
                  ? 'text-violet-600' 
                  : 'text-gray-500 hover:text-violet-600'
                }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-violet-600' : 'text-gray-500'}`} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
                    {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                  </span>
                )}
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}