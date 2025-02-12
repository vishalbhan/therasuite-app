import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

const Onboarding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      // Check if profile is already complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarding_complete')
        .eq('id', session.user.id)
        .single();

      if (profile?.is_onboarding_complete) {
        navigate("/dashboard");
      }
    };

    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Complete Your Profile</h1>
        <p className="text-gray-600 mt-2">
          Let's set up your professional profile to get started
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
};

export default Onboarding;
