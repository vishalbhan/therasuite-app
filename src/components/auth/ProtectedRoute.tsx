import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Outlet } from "react-router-dom";
import LogRocket from "logrocket";
import { LoadingScreen } from "@/components/ui/loading-screen";

export function ProtectedRoute() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate("/");
          return;
        }

        // Check if profile is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_onboarding_complete, full_name, analytics_consent')
          .eq('id', session.user.id)
          .single();

        // Only identify user in LogRocket if they have given consent and LogRocket is enabled
        if (import.meta.env.VITE_LOGROCKET_ID && profile?.analytics_consent) {
          try {
            LogRocket.identify(session.user.id, {
              email: session.user.email,
              name: profile.full_name || 'Unknown',
            });
          } catch (error) {
            console.warn('LogRocket identification failed:', error);
          }
        }

        if (!profile?.is_onboarding_complete) {
          navigate("/onboarding");
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <Outlet />;
} 