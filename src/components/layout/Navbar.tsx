import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Receipt,
  Plus,
  Settings
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
    label: "Earnings",
    icon: Receipt,
    href: "/earnings",
  },
];

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link to="/dashboard" className="text-xl font-bold text-violet-800">
                TheraSuite
              </Link>
            </div>

            <div className="flex space-x-4">
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

          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate("/dashboard?modal=create")}
              className="bg-violet-800 hover:bg-violet-900"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Appointment
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
                    <Settings className="scale-[1.2]" />
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