import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Toaster as SonnerToaster } from "sonner";
import { Toaster as AppToaster } from "@/components/ui/toaster";
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
import * as Sentry from "@sentry/react";
import ClientDetails from "@/pages/ClientDetails";
import Invoices from "./pages/Invoices";
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import Notes from "@/pages/Notes";

Sentry.init({
  dsn: "https://c334fd579dde037ecd1c5bce5e10f0fe@o4509881793380352.ingest.us.sentry.io/4509881799802880",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  beforeSend(event, hint) {
    // Filter out specific Dyte audio device detection errors
    if (event.exception?.values) {
      for (const exception of event.exception.values) {
        if (exception.value?.includes('ERR1608') || 
            exception.value?.includes('No audio output devices') ||
            exception.value?.includes('No speaker found') ||
            exception.value?.includes('LocalMediaHandler')) {
          console.warn('Filtering out non-critical Dyte audio detection error:', exception.value);
          return null; // Don't send this event to Sentry
        }
      }
    }

    // Filter out errors in the error message/fingerprint
    if (event.message?.includes('ERR1608') || 
        event.message?.includes('No audio output devices') ||
        event.message?.includes('No speaker found')) {
      console.warn('Filtering out non-critical Dyte audio detection error:', event.message);
      return null;
    }

    // Allow all other events to be sent
    return event;
  }
});

const App = () => {
  return (
    <CurrencyProvider>
      <Helmet>
        <title>TheraSuite</title>
      </Helmet>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {/* App-wide toast providers */}
          <AppToaster />
          <SonnerToaster />
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
