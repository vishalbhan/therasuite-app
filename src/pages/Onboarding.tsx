
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Onboarding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
      }
    };

    checkSession();
  }, [navigate]);

  const handleComplete = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to TheraSuite!</h1>
        <p className="text-gray-600 mb-8">Let's get you started...</p>
        <Button onClick={handleComplete}>Complete Onboarding</Button>
      </div>
    </div>
  );
};

export default Onboarding;
