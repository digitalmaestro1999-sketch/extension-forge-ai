import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plug, Plus, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  service: string;
  key: string;
  added: string;
}

const apiServices = [
  { name: "OpenAI", description: "GPT models for AI features", docsUrl: "https://platform.openai.com/api-keys" },
  { name: "Google", description: "YouTube, Maps, and other Google APIs", docsUrl: "https://console.cloud.google.com/" },
  { name: "NVIDIA NIM", description: "NVIDIA inference microservices", docsUrl: "https://build.nvidia.com/" },
  { name: "Twitter/X", description: "Twitter API for social features", docsUrl: "https://developer.twitter.com/" },
  { name: "Custom REST API", description: "Any REST API endpoint", docsUrl: "" },
];

export default function ApiManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newService, setNewService] = useState("OpenAI");

  useEffect(() => {
    const stored = localStorage.getItem("extension-forge-api-keys");
    if (stored) try { setKeys(JSON.parse(stored)); } catch {}
  }, []);

  const saveKeys = (updated: ApiKey[]) => {
    setKeys(updated);
    localStorage.setItem("extension-forge-api-keys", JSON.stringify(updated));
  };

  const addKey = () => {
    if (!newName.trim() || !newKey.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    const newEntry: ApiKey = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      service: newService,
      key: newKey.trim(),
      added: new Date().toISOString(),
    };
    saveKeys([...keys, newEntry]);
    setNewName("");
    setNewKey("");
    toast.success("API key added");
  };

  const removeKey = (id: string) => {
    saveKeys(keys.filter(k => k.id !== id));
    toast.success("API key removed");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="h-6 w-6 text-accent" />
          API Manager
        </h1>
        <p className="text-muted-foreground mt-1">Manage API keys for extension integrations</p>
      </motion.div>

      {/* Supported services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {apiServices.map(svc => (
          <div key={svc.name} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold">{svc.name}</h3>
              {svc.docsUrl && (
                <a href={svc.docsUrl} target="_blank" rel="noopener" className="text-muted-foreground hover:text-primary">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{svc.description}</p>
          </div>
        ))}
      </div>

      {/* Add new key */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Add API Key</h3>
        <p className="text-xs text-muted-foreground">
          Keys are stored locally in your browser. For production use, store them securely in your extension's .env file.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <select
              value={newService}
              onChange={e => setNewService(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm"
            >
              {apiServices.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              placeholder="e.g., My OpenAI Key"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">API Key</Label>
            <Input
              placeholder="sk-..."
              type="password"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
        </div>
        <Button onClick={addKey} variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Key
        </Button>
      </div>

      {/* Stored keys */}
      {keys.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Stored Keys ({keys.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {keys.map(k => (
              <div key={k.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{k.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{k.service}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {showKey[k.id] ? k.key : "•".repeat(Math.min(k.key.length, 32))}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowKey(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
                >
                  {showKey[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeKey(k.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
