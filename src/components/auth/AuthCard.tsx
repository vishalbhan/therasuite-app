import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as z from "zod";
import * as Sentry from "@sentry/react";
import { AuthError } from "@supabase/supabase-js";

const AuthCard = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;

        // Add Sentry user identification
        Sentry.setUser({
          id: data.user.id,
          email: data.user.email,
        });

        // Check if profile is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_onboarding_complete, full_name')
          .eq('id', data.user.id)
          .single();

        // Update Sentry with name if available
        if (profile?.full_name) {
          Sentry.setUser({
            id: data.user.id,
            email: data.user.email,
            username: profile.full_name,
          });
        }

        navigate(profile?.is_onboarding_complete ? "/dashboard" : "/onboarding");
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: '',
              is_onboarding_complete: false,
            },
          },
        });
        
        if (authError) throw authError;
        if (!authData.user) throw new Error("No user data");

        // Try to get existing profile first
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select()
          .eq('id', authData.user.id)
          .single();

        // Only create profile if it doesn't exist
        if (!existingProfile) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email,
              is_onboarding_complete: false,
            });

          if (profileError) throw profileError;
        }

        toast.success("Account created successfully");
        
        navigate("/onboarding");
      }
    } catch (error) {
      console.error('Authentication error:', error);
      
      // Handle Supabase Auth errors
      if (error instanceof AuthError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unexpected error occurred");
      }
      
      toast.error(errorMessage || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isLogin ? "Welcome back" : "Create an account"}</CardTitle>
        <CardDescription>
          {isLogin
            ? "Enter your credentials to access your account"
            : "Sign up for a new account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAuth} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
              {errorMessage}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
          <p className="text-center text-sm text-gray-600">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

export default AuthCard;
