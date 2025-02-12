import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string>("");

  useEffect(() => {
    const checkSessionAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      // Fetch user's profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      if (error) {
        toast.error("Error fetching profile");
        return;
      }

      if (profile?.full_name) {
        // Get first name by splitting at first space
        const firstName = profile.full_name.split(' ')[0];
        setFullName(firstName);
      }
    };

    checkSessionAndProfile();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>
        <p className="text-gray-600">
          {getGreeting()}{fullName ? `, ${fullName}` : ''}!
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
