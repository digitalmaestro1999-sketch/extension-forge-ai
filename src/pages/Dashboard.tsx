import { motion } from "framer-motion";
import { Zap, Package, Code2, TestTube2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "Extensions Built", value: "0", icon: Package },
  { label: "Lines Generated", value: "0", icon: Code2 },
  { label: "Tests Passed", value: "0", icon: TestTube2 },
];

const quickActions = [
  { label: "Create from Idea", description: "Describe your extension and AI builds it", path: "/create", color: "primary" },
  { label: "Use Template", description: "Start from a pre-built extension template", path: "/templates", color: "accent" },
  { label: "Open Editor", description: "Edit extension code in Monaco editor", path: "/editor", color: "secondary" },
];

export default function Dashboard() {
  const navigate = useNavigate();

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
              <p className="text-sm text-muted-foreground">AI-Powered Chrome Extension Builder</p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-lg mt-4">
            Describe your idea, and AI generates a complete Chrome extension — manifest, scripts, popup UI, and more. Ready to package and publish.
          </p>
        </div>
      </motion.div>

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

      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i }}
              onClick={() => navigate(action.path)}
              className="group text-left rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:glow-primary transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{action.label}</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
