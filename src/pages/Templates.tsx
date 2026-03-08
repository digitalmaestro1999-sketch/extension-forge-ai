import { motion } from "framer-motion";
import { Blocks, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { templates, categories } from "@/lib/extension-templates";
import { useState } from "react";
import type { ExtensionSpec } from "@/lib/generate-extension";

export default function Templates() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? templates.filter((t) => t.category === activeCategory) : templates;

  const handleUse = (t: typeof templates[0]) => {
    const spec: ExtensionSpec = {
      name: t.name,
      description: t.description,
      features: t.features,
      permissions: t.permissions,
      hostPermissions: ["https://*/*"],
      apis: [],
    };
    sessionStorage.setItem("extension-spec", JSON.stringify(spec));
    navigate("/editor");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Blocks className="h-6 w-6 text-accent" />
          Extension Templates
        </h1>
        <p className="text-muted-foreground mt-1">Start from a proven template and customize</p>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={activeCategory === null ? "default" : "secondary"}
          className="cursor-pointer"
          onClick={() => setActiveCategory(null)}
        >
          All
        </Badge>
        {categories.map((c) => (
          <Badge
            key={c}
            variant={activeCategory === c ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setActiveCategory(c)}
          >
            {c}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{t.icon}</span>
              <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
            </div>
            <h3 className="font-semibold mb-1">{t.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t.description}</p>
            <div className="flex flex-wrap gap-1 mb-4">
              {t.permissions.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px] font-mono">{p}</Badge>
              ))}
            </div>
            <Button
              onClick={() => handleUse(t)}
              variant="outline"
              size="sm"
              className="w-full group-hover:border-primary group-hover:text-primary transition-colors"
            >
              Use Template <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
