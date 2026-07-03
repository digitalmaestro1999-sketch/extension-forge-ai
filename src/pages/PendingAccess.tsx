import { motion } from "framer-motion";
import { Clock, Mail, LogOut, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function PendingAccess() {
  const { user, status, signOut } = useAuth();
  const declined = status === "declined";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <Card className="border-border bg-card/80 backdrop-blur">
          <CardContent className="p-8 space-y-6 text-center">
            <div className={`h-16 w-16 rounded-2xl mx-auto flex items-center justify-center ${
              declined ? "bg-destructive/10 text-destructive" : "bg-gradient-cyber text-primary-foreground"
            }`}>
              {declined ? <ShieldX className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                {declined ? "Access declined" : "Waiting for approval"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {declined
                  ? "Your account request was declined by an administrator. If you believe this is a mistake, please reach out to the platform owner."
                  : "Thanks for signing up! Your account is pending review by a superadmin. You'll get access to Extension Forge AI as soon as it's approved."}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 p-4 text-left text-sm space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="font-mono">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Status: <span className={declined ? "text-destructive font-semibold" : "text-primary font-semibold"}>
                  {status ?? "pending"}
                </span>
              </div>
            </div>

            {!declined && (
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Most approvals happen within a few hours during business days.
              </div>
            )}

            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
