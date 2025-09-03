import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  FileText,
  Receipt
} from "lucide-react";

const bottomNavItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
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

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-5">
      <div className="flex items-center justify-around py-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center px-3 py-2 text-xs font-medium transition-colors min-w-0 flex-1
                ${isActive 
                  ? 'text-violet-600' 
                  : 'text-gray-500 hover:text-violet-600'
                }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-violet-600' : 'text-gray-500'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}