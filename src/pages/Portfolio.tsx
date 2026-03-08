import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, TrendingUp, DollarSign, Package, ExternalLink, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  spec: any;
  created_at: string;
};

const CATEGORIES = ["YouTube Tools", "Productivity", "SEO Tools", "AI Assistants", "E-commerce", "Automation", "Other"];

function guessCategory(name: string, desc: string | null): string {
  const text = `${name} ${desc || ""}`.toLowerCase();
  if (text.includes("youtube") || text.includes("video")) return "YouTube Tools";
  if (text.includes("seo") || text.includes("keyword") || text.includes("meta")) return "SEO Tools";
  if (text.includes("price") || text.includes("amazon") || text.includes("coupon") || text.includes("shop")) return "E-commerce";
  if (text.includes("ai") || text.includes("summar") || text.includes("gpt")) return "AI Assistants";
  if (text.includes("tab") || text.includes("clipboard") || text.includes("block") || text.includes("productivity")) return "Productivity";
  if (text.includes("automat") || text.includes("scrape")) return "Automation";
  return "Other";
}

export default function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("extension_projects")
      .select("id, name, description, status, spec, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProjects(data || []);
        setLoading(false);
      });
  }, [user]);

  const categoryMap = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = projects.filter((p) => guessCategory(p.name, p.description) === cat);
    return acc;
  }, {} as Record<string, Project[]>);

  const totalExtensions = projects.length;
  const publishedCount = projects.filter((p) => p.status === "published").length;
  const draftCount = projects.filter((p) => p.status === "draft").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Extension Portfolio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your extension network across categories</p>
        </div>
        <Button onClick={() => navigate("/create")} className="bg-gradient-cyber text-primary-foreground">
          <Package className="h-4 w-4 mr-2" />
          Add Extension
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Extensions", value: totalExtensions, icon: Package },
          { label: "Published", value: publishedCount, icon: ExternalLink },
          { label: "In Development", value: draftCount, icon: BarChart3 },
          { label: "Categories", value: Object.values(categoryMap).filter((v) => v.length > 0).length, icon: Briefcase },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <s.icon className="h-4 w-4" />
                  <span className="text-xs">{s.label}</span>
                </div>
                <p className="text-2xl font-bold font-mono">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const items = categoryMap[cat];
          if (!items || items.length === 0) return null;
          return (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{cat}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        sessionStorage.setItem("currentFiles", JSON.stringify((p as any).files || {}));
                        sessionStorage.setItem("currentSpec", JSON.stringify(p.spec));
                        navigate("/editor");
                      }}
                      className="text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm truncate">{p.name}</h4>
                        <Badge variant={p.status === "published" ? "default" : "secondary"} className="text-[10px]">
                          {p.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || "No description"}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!loading && projects.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No extensions yet. Create your first one!</p>
              <Button onClick={() => navigate("/create")} variant="outline" className="mt-4">
                Create Extension
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
