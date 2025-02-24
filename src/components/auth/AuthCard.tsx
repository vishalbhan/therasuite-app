import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as yup from 'yup';
import LogRocket from "logrocket";

const AuthCard = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;

        // Add LogRocket identification
        LogRocket.identify(data.user.id, {
          email: data.user.email,
        });

        // Check if profile is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_onboarding_complete, full_name')
          .eq('id', data.user.id)
          .single();

        // Update LogRocket with name if available
        if (profile?.full_name) {
          LogRocket.identify(data.user.id, {
            email: data.user.email,
            name: profile.full_name,
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

        toast({
          title: "Success",
          description: "Account created successfully",
        });
        
        navigate("/onboarding");
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const schema = yup.object({
    email: yup.string().email().required(),
    password: yup.string().min(6).required()
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
