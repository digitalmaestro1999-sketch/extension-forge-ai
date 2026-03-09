import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const buildFallbackResults = (niche: string) => {
  const normalized = niche.trim() || "productivity";
  const titleBase = normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return [
    {
      opportunity: `${titleBase} Workflow Copilot`,
      description: `Guided daily workflows and automation suggestions for ${normalized} users.`,
      demand_score: 72,
      competition_score: 46,
      revenue_potential: "medium",
      category: normalized,
      features: ["Workflow templates", "Usage analytics", "One-click automations"],
    },
    {
      opportunity: `${titleBase} Insight Tracker`,
      description: `Tracks key signals, trends, and performance benchmarks in the ${normalized} space.`,
      demand_score: 78,
      competition_score: 41,
      revenue_potential: "high",
      category: normalized,
      features: ["Trend alerts", "Competitor snapshots", "Weekly digest"],
    },
  ];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a Chrome extension market analyst. Analyze the "${niche}" market and discover 5 profitable Chrome extension opportunities that don't exist yet or have weak competition.

For each opportunity, provide:
- opportunity: catchy extension name/concept
- description: what it does and why users need it
- demand_score: 0-100 (based on market need)
- competition_score: 0-100 (lower = less competition = better)
- revenue_potential: "low", "medium", or "high"
- category: extension category
- features: array of 3-4 key features

Return ONLY valid JSON array:
[
  {
    "opportunity": "Extension Name",
    "description": "Description of what it does",
    "demand_score": 85,
    "competition_score": 30,
    "revenue_potential": "high",
    "category": "Productivity",
    "features": ["feature1", "feature2", "feature3"]
  }
]

Focus on:
- High demand, low competition gaps
- Monetization potential (freemium, API usage)
- Practical real-world problems
- Manifest V3 feasibility`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a Chrome extension market analyst. Return only valid JSON arrays." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({
          warning: "AI credits are currently unavailable. Showing fallback opportunities.",
          results: buildFallbackResults(niche),
          fallback: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let results;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found");
      }
    } catch {
      results = [{
        opportunity: `${niche} Helper Extension`,
        description: `A helpful tool for ${niche} users`,
        demand_score: 70,
        competition_score: 50,
        revenue_potential: "medium",
        category: niche,
        features: ["Core functionality", "Settings", "Export"],
      }];
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("discover-trends error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
