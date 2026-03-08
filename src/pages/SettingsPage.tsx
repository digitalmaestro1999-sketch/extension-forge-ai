import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Moon, Sun, Key, Bell, Database, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoDebug, setAutoDebug] = useState(true);
  const [autoPermissions, setAutoPermissions] = useState(true);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-muted-foreground" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure your Extension Forge environment</p>
      </motion.div>

      {/* AI Settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">AI Agent Settings</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto-Debug Mode</p>
            <p className="text-xs text-muted-foreground">AI automatically fixes errors in generated code</p>
          </div>
          <Switch checked={autoDebug} onCheckedChange={setAutoDebug} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Smart Permission Detection</p>
            <p className="text-xs text-muted-foreground">Automatically detect and minimize required permissions</p>
          </div>
          <Switch checked={autoPermissions} onCheckedChange={setAutoPermissions} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Notifications</p>
            <p className="text-xs text-muted-foreground">Get notified when agent pipeline completes</p>
          </div>
          <Switch checked={notifications} onCheckedChange={setNotifications} />
        </div>
      </div>

      {/* About */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">About</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Version</span>
          <Badge variant="secondary" className="font-mono">1.0.0</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">AI Model</span>
          <Badge variant="secondary" className="font-mono">gemini-3-flash</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Manifest Version</span>
          <Badge variant="secondary" className="font-mono">V3</Badge>
        </div>
      </div>

      {/* Data */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Data</h3>
        <Button
          variant="outline"
          className="text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => {
            sessionStorage.clear();
            toast.success("Session data cleared");
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Session Data
        </Button>
      </div>
    </div>
  );
}
