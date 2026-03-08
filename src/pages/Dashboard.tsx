import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Package, Code2, TestTube2, ArrowRight, TrendingUp, Layers, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projectCount, setProjectCount] = useState(0);
  const [trendCount, setTrendCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("extension_projects").select("id", { count: "exact", head: true }).eq("user_id", user.id).then(({ count }) => setProjectCount(count || 0));
    supabase.from("trend_discoveries").select("id", { count: "exact", head: true }).eq("user_id", user.id).then(({ count }) => setTrendCount(count || 0));
    supabase.from("batch_queue").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "queued").then(({ count }) => setQueueCount(count || 0));
  }, [user]);

  const stats = [
    { label: "Extensions Built", value: String(projectCount), icon: Package },
    { label: "Trends Discovered", value: String(trendCount), icon: TrendingUp },
    { label: "Queue Items", value: String(queueCount), icon: Layers },
  ];

  const quickActions = [
    { label: "Discover Trends", description: "AI finds profitable extension opportunities", path: "/trends", icon: TrendingUp },
    { label: "Create Extension", description: "One prompt → full autonomous pipeline", path: "/create", icon: Zap },
    { label: "Batch Generate", description: "Queue multiple ideas for mass generation", path: "/batch", icon: Layers },
    { label: "View Projects", description: "Browse and manage saved extensions", path: "/projects", icon: FolderOpen },
    { label: "Use Template", description: "Start from a proven extension template", path: "/templates", icon: Code2 },
    { label: "AI Chat Builder", description: "Chat with AI about Chrome extensions", path: "/ai-builder", icon: TestTube2 },
  ];

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-border bg-card p-8"
      >
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-cyber flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient-cyber">Extension Forge AI</h1>
              <p className="text-sm text-muted-foreground">Autonomous Chrome Extension Factory</p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-xl mt-4">
            AI-powered platform that discovers trends, generates complete Chrome extensions, tests them, and prepares store listings — all autonomously.
          </p>
          {!user && (
            <motion.button
              onClick={() => navigate("/auth")}
              className="mt-4 px-4 py-2 rounded-lg bg-gradient-cyber text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Sign In to Get Started
            </motion.button>
          )}
        </div>
      </motion.div>

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <stat.icon className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-3xl font-bold mt-2 font-mono">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Agent Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
              onClick={() => navigate(action.path)}
              className="group text-left rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:glow-primary transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <action.icon className="h-5 w-5 text-primary" />
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold">{action.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
