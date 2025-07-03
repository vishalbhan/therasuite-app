import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Toaster } from "sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Schedule from "@/pages/Schedule";
import Clients from "@/pages/Clients";
import Index from "@/pages/Index";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";
import VideoSession from "@/pages/VideoSession";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import AuthCard from "@/components/auth/AuthCard";
import { AuthLayout } from "@/components/auth/AuthLayout";
import ClientVideoSession from "@/pages/ClientVideoSession";
import Settings from "@/pages/Settings";
import LogRocket from 'logrocket';
import ClientDetails from "@/pages/ClientDetails";
import Invoices from "./pages/Invoices";
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import Notes from "@/pages/Notes";

// Initialize LogRocket only if environment variable is set and in production
if (import.meta.env.VITE_LOGROCKET_ID && import.meta.env.PROD) {
  LogRocket.init(import.meta.env.VITE_LOGROCKET_ID);
}

const App = () => {
  return (
    <CurrencyProvider>
      <Helmet>
        <title>TheraSuite</title>
      </Helmet>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router>
            <Routes>
              <Route path="/" element={<AuthLayout />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/video/:appointmentId" element={<VideoSession />} />
              <Route path="/client-video/:appointmentId" element={<ClientVideoSession />} />
              
              {/* Wrap all dashboard routes with ProtectedRoute */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/:clientId" element={<ClientDetails />} />
                  <Route path="/notes" element={<Notes />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </CurrencyProvider>
  );
};

export default App;
