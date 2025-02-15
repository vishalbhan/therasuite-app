import AuthCard from "./AuthCard";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarketingSection } from "./MarketingSection";

export function AuthLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };

    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Marketing Section - Left Column */}
      <div className="hidden lg:block lg:w-1/2">
        <MarketingSection />
      </div>

      {/* Auth Section - Right Column */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-violet-800 mb-2">TheraSuite</h1>
              <p className="text-gray-600">Streamline your therapy practice</p>
            </div>
            <AuthCard />
          </div>
        </main>
      </div>
    </div>
  );
} 