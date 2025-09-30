import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Receipt,
  Plus,
  Settings,
  FileText,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { getAppointmentRequestsForTherapist } from "@/lib/appointment-requests";

const navItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Schedule",
    icon: Calendar,
    href: "/schedule",
    hideOnMobile: true,
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

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
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
        .channel('appointment_requests_changes')
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
    <nav className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/dashboard" className="text-xl font-bold text-violet-800">
                TheraSuite
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:space-x-4 md:ml-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                const showBadge = item.label === "Requests" && pendingRequestsCount > 0;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors relative
                      ${isActive 
                        ? 'bg-violet-100 text-violet-900' 
                        : 'text-gray-600 hover:bg-violet-50 hover:text-violet-900'
                      }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                    {showBadge && (
                      <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">

            <Button
              onClick={() => navigate("/dashboard?modal=create")}
              className="bg-black hover:bg-gray-900 hidden sm:flex group items-center justify-center"
            >
              <Plus className="h-4 w-4 -mr-[0.4rem]" />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-1 transition-all duration-300 ease-in-out">
                Create Appointment
              </span>
            </Button>

            <Button
              onClick={() => navigate("/dashboard?modal=create")}
              className="bg-black hover:bg-gray-900 sm:hidden"
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/settings")}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

      </div>
    </nav>
  );
} 