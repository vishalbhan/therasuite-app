import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { BottomNavigation } from "./BottomNavigation";

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
} 