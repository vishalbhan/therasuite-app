import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Outlet } from "react-router-dom";

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
          .select('is_onboarding_complete')
          .eq('id', session.user.id)
          .single();

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
    return <div>Loading...</div>; // You might want to replace this with a proper loading component
  }

  return <Outlet />;
} 