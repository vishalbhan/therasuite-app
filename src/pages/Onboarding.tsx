import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useState } from "react";

const Onboarding = () => {
  const navigate = useNavigate();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

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
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="flex justify-end p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSignOutModal(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Power className="h-4 w-4" />
          </Button>
        </div>
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Complete Your Profile</h1>
            <p className="text-gray-600 mt-2">
              Let's set up your professional profile to get started
            </p>
          </div>
          <OnboardingForm />
        </div>
      </div>

      <ConfirmModal
        open={showSignOutModal}
        onOpenChange={setShowSignOutModal}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmText="Yes, sign out"
        cancelText="No, stay signed in"
        onConfirm={handleSignOut}
      />
    </>
  );
};

export default Onboarding;
