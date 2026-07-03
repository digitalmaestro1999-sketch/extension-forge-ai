import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, Loader2, Sparkles, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"password" | "magic">("magic");
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account!");
      }
    } catch (e: any) {
      toast.error(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMagicSent(true);
      toast.success("Magic link sent — check your inbox!");
    } catch (e: any) {
      toast.error(e.message || "Could not send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-cyber flex items-center justify-center mx-auto mb-4">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gradient-cyber">Extension Forge AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in with Google or a one-time magic link
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <Button onClick={handleGoogleAuth} variant="outline" className="w-full">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative py-1">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "password" | "magic")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="magic" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Magic link
              </TabsTrigger>
              <TabsTrigger value="password" className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Password
              </TabsTrigger>
            </TabsList>

            <TabsContent value="magic" className="mt-4">
              {magicSent ? (
                <div className="text-center space-y-2 py-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">Check your inbox</p>
                  <p className="text-xs text-muted-foreground">
                    We sent a sign-in link to <span className="font-mono">{email}</span>.
                  </p>
                  <button
                    onClick={() => setMagicSent(false)}
                    className="text-xs text-primary hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-9 bg-secondary border-border"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-cyber text-primary-foreground"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Send magic link
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    No password needed — we'll email you a one-time sign-in link.
                  </p>
                </form>
              )}
            </TabsContent>

            <TabsContent value="password" className="mt-4">
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-9 bg-secondary border-border"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 bg-secondary border-border"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-cyber text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? "Sign In" : "Sign Up"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-primary hover:underline"
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
}
