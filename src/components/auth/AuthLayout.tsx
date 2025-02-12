import AuthCard from "./AuthCard";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-violet-800 mb-2">TheraSuite</h1>
            <p className="text-gray-600">Streamline your therapy practice</p>
          </div>
          <AuthCard />
        </div>
      </main>
    </div>
  );
} 