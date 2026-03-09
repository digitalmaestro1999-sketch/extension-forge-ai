import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Loader2, Search, Sparkles, ArrowRight,
  BarChart3, Target, DollarSign, RefreshCw, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface TrendResult {
  opportunity: string;
  description: string;
  demand_score: number;
  competition_score: number;
  revenue_potential: "low" | "medium" | "high";
  category: string;
  features: string[];
}

export default function TrendDiscovery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [niche, setNiche] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [results, setResults] = useState<TrendResult[]>([]);
  const [creditsUnavailable, setCreditsUnavailable] = useState(false);

  const checkCredits = async () => {
    try {
      const { data } = await supabase.functions.invoke("discover-trends", {
        body: { niche: "__ping__" },
      });
      setCreditsUnavailable(!!data?.fallback);
    } catch {
      // ignore
    }
  };

  useState(() => { checkCredits(); });

  const discover = async () => {
    if (!niche.trim()) {
      toast.error("Enter a niche or market to discover trends");
      return;
    }
    setIsDiscovering(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("discover-trends", {
        body: { niche: niche.trim() },
      });

      if (error) throw error;
      if (!data?.results) throw new Error("No results");

      setResults(data.results);

      if (data?.warning) {
        toast.warning(data.warning);
      }

      // Save to DB if logged in
      if (user) {
        for (const r of data.results) {
          await supabase.from("trend_discoveries").insert({
            user_id: user.id,
            opportunity: r.opportunity,
            description: r.description,
            demand_score: r.demand_score,
            competition_score: r.competition_score,
            revenue_potential: r.revenue_potential,
            category: r.category,
          });
        }
      }

      toast.success(`Found ${data.results.length} opportunities!`);
    } catch (e: any) {
      const message = e?.message || "Discovery failed";
      toast.error(message.includes("Payment required") ? "AI credits are currently unavailable for trend discovery" : message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const buildFromTrend = (trend: TrendResult) => {
    sessionStorage.setItem("pending-idea", trend.opportunity + ": " + trend.description);
    navigate("/create");
  };

  const revenueBadge = (rev: string) => {
    const colors: Record<string, string> = {
      high: "bg-primary/20 text-primary",
      medium: "bg-warning/20 text-warning",
      low: "bg-muted text-muted-foreground",
    };
    return colors[rev] || colors.medium;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          AI Trend Discovery Agent
        </h1>
        <p className="text-muted-foreground mt-1">
          AI analyzes markets to find profitable Chrome extension opportunities
        </p>
      </motion.div>

      {creditsUnavailable && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>AI credits are currently unavailable — results will use fallback data.</span>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter a niche (e.g., 'productivity', 'AI tools', 'SEO', 'social media')..."
              value={niche}
              onChange={e => setNiche(e.target.value)}
              className="pl-9 bg-secondary border-border"
              onKeyDown={e => e.key === "Enter" && discover()}
              disabled={isDiscovering}
            />
          </div>
          <Button
            onClick={discover}
            disabled={isDiscovering}
            className="bg-gradient-cyber text-primary-foreground shrink-0"
          >
            {isDiscovering ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Discovering...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Discover Trends</>
            )}
          </Button>
        </div>
        <div className="flex gap-2 mt-3">
          {["productivity", "AI tools", "SEO", "social media", "developer tools", "e-commerce"].map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer text-xs hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => setNiche(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </motion.div>

      {isDiscovering && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 glow-primary">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Trend Discovery Agent is analyzing...</p>
              <p className="text-xs text-muted-foreground">Scanning markets, competition, and demand signals</p>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{results.length} Opportunities Found</h2>
          {results.map((trend, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{trend.opportunity}</h3>
                    <Badge variant="outline" className="text-[10px]">{trend.category}</Badge>
                    <Badge className={`text-[10px] ${revenueBadge(trend.revenue_potential)}`}>
                      <DollarSign className="h-2.5 w-2.5 mr-0.5" />{trend.revenue_potential}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{trend.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" /> Demand
                        </span>
                        <span className="font-mono">{trend.demand_score}%</span>
                      </div>
                      <Progress value={trend.demand_score} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" /> Competition
                        </span>
                        <span className="font-mono">{trend.competition_score}%</span>
                      </div>
                      <Progress value={trend.competition_score} className="h-1.5" />
                    </div>
                  </div>

                  {trend.features && (
                    <div className="flex flex-wrap gap-1">
                      {trend.features.slice(0, 4).map((f, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px]">{f}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => buildFromTrend(trend)}
                  variant="outline"
                  size="sm"
                  className="shrink-0 group-hover:border-primary group-hover:text-primary transition-colors"
                >
                  Build <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
