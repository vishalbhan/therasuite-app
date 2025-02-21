import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Receipt,
  Plus,
  Settings,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

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
  },
  {
    label: "Clients",
    icon: Users,
    href: "/clients",
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive 
                        ? 'bg-violet-100 text-violet-900' 
                        : 'text-gray-600 hover:bg-violet-50 hover:text-violet-900'
                      }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Button
              onClick={() => navigate("/dashboard?modal=create")}
              className="bg-violet-800 hover:bg-violet-900 hidden sm:flex"
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Create Appointment</span>
            </Button>

            <Button
              onClick={() => navigate("/dashboard?modal=create")}
              className="bg-violet-800 hover:bg-violet-900 sm:hidden"
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

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t py-2">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive 
                        ? 'bg-violet-100 text-violet-900' 
                        : 'text-gray-600 hover:bg-violet-50 hover:text-violet-900'
                      }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
} 