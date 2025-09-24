import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Receipt,
  Plus,
  Settings,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  return (
    <nav className="border-b bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/dashboard" className="flex items-center space-x-2">
                {/* <img 
                  src="/android-chrome-192x192.png" 
                  alt="TheraSuite Logo" 
                  className="h-8 w-8 rounded-lg"
                /> */}
                <span className="text-xl font-bold text-purple-600">
                  TheraSuite
                </span>
              </Link>
            </div>
          </div>

          {/* Centered Desktop Navigation */}
          <div className="hidden md:flex md:space-x-4 absolute left-1/2 transform -translate-x-1/2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-600 hover:bg-purple-100 hover:text-violet-900'
                    }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}
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