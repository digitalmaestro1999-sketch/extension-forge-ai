import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Users, DollarSign, Star, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Project = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  description: string | null;
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function RevenueTracker() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("extension_projects")
      .select("id, name, status, created_at, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects(data || []));
  }, [user]);

  // Simulated analytics based on real project data
  const totalExtensions = projects.length;
  const estimatedInstalls = totalExtensions * 1250;
  const estimatedActiveUsers = Math.round(estimatedInstalls * 0.2);
  const estimatedPremiumRate = 0.03;
  const estimatedPremiumUsers = Math.round(estimatedActiveUsers * estimatedPremiumRate);
  const avgRevPerUser = 6;
  const estimatedMRR = estimatedPremiumUsers * avgRevPerUser;

  // Monthly growth chart
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = d.toLocaleString("default", { month: "short" });
    const projectsBefore = projects.filter((p) => new Date(p.created_at) <= d).length;
    return {
      month,
      extensions: projectsBefore,
      installs: projectsBefore * 1250,
      revenue: Math.round(projectsBefore * 1250 * 0.2 * estimatedPremiumRate * avgRevPerUser),
    };
  });

  // Category distribution
  const categoryCount: Record<string, number> = {};
  projects.forEach((p) => {
    const text = `${p.name} ${p.description || ""}`.toLowerCase();
    let cat = "Other";
    if (text.includes("youtube") || text.includes("video")) cat = "YouTube";
    else if (text.includes("seo") || text.includes("keyword")) cat = "SEO";
    else if (text.includes("ai") || text.includes("summar")) cat = "AI";
    else if (text.includes("product") || text.includes("tab")) cat = "Productivity";
    else if (text.includes("price") || text.includes("shop")) cat = "E-commerce";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  const pieData = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));

  // Per-extension performance (simulated)
  const extensionPerformance = projects.slice(0, 10).map((p) => {
    const installs = Math.round(800 + Math.random() * 2000);
    const active = Math.round(installs * (0.15 + Math.random() * 0.15));
    const premium = Math.round(active * (0.02 + Math.random() * 0.03));
    return {
      name: p.name.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
      fullName: p.name,
      installs,
      activeUsers: active,
      premiumUsers: premium,
      mrr: premium * avgRevPerUser,
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
    };
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Revenue Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Portfolio analytics and revenue projections
          <Badge variant="outline" className="ml-2 text-[10px]">Simulated</Badge>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Extensions", value: totalExtensions, icon: Download, fmt: String },
          { label: "Est. Installs", value: estimatedInstalls, icon: Download, fmt: (v: number) => v.toLocaleString() },
          { label: "Active Users", value: estimatedActiveUsers, icon: Users, fmt: (v: number) => v.toLocaleString() },
          { label: "Premium Users", value: estimatedPremiumUsers, icon: Star, fmt: String },
          { label: "Est. MRR", value: estimatedMRR, icon: DollarSign, fmt: (v: number) => `$${v.toLocaleString()}` },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <s.icon className="h-3.5 w-3.5" />
                  <span className="text-[11px]">{s.label}</span>
                </div>
                <p className="text-xl font-bold font-mono">{s.fmt(s.value)}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Revenue Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`$${value}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Category Split</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {extensionPerformance.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Extension Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Extension</th>
                    <th className="py-2 pr-4 font-medium text-right">Installs</th>
                    <th className="py-2 pr-4 font-medium text-right">Active</th>
                    <th className="py-2 pr-4 font-medium text-right">Premium</th>
                    <th className="py-2 pr-4 font-medium text-right">MRR</th>
                    <th className="py-2 font-medium text-right">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {extensionPerformance.map((ext, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 pr-4 font-medium">{ext.name}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs">{ext.installs.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs">{ext.activeUsers.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs">{ext.premiumUsers}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs text-primary">${ext.mrr}</td>
                      <td className="py-2.5 text-right">
                        <Badge variant="secondary" className="text-[10px]">⭐ {ext.rating}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
