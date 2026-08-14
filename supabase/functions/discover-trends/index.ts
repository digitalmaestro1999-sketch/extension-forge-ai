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

  const concepts = [
    { suffix: "Workflow Copilot", desc: "Guided daily workflows and automation suggestions", features: ["Workflow templates", "Usage analytics", "One-click automations"], demand: 72, comp: 46, rev: "medium" },
    { suffix: "Insight Tracker", desc: "Tracks key signals, trends, and performance benchmarks", features: ["Trend alerts", "Competitor snapshots", "Weekly digest"], demand: 78, comp: 41, rev: "high" },
    { suffix: "Focus Guardian", desc: "Blocks distractions and enforces deep-work sessions", features: ["Site blocking", "Pomodoro timer", "Focus reports"], demand: 74, comp: 55, rev: "medium" },
    { suffix: "Smart Clipper", desc: "Save, tag, and organise web snippets with AI summaries", features: ["AI tagging", "Full-text search", "Cross-device sync"], demand: 76, comp: 48, rev: "medium" },
    { suffix: "Price Sentinel", desc: "Monitors price changes and alerts on drops or deals", features: ["Price history", "Deal alerts", "Wishlist sync"], demand: 82, comp: 60, rev: "high" },
    { suffix: "Meeting Coach", desc: "Live prompts and post-call summaries for online meetings", features: ["Live cues", "Auto summary", "Action items"], demand: 80, comp: 52, rev: "high" },
    { suffix: "Tab Marshal", desc: "Auto-groups, hibernates, and restores tabs by project", features: ["Auto grouping", "Session save", "Memory saver"], demand: 70, comp: 58, rev: "low" },
    { suffix: "Privacy Shield", desc: "One-click permission audit and tracker blocker", features: ["Tracker report", "Permission audit", "Site rules"], demand: 77, comp: 50, rev: "medium" },
    { suffix: "Writing Refiner", desc: "Context-aware rewrite, tone, and clarity assistant", features: ["Tone shift", "Grammar fix", "Style presets"], demand: 84, comp: 62, rev: "high" },
    { suffix: "Research Ledger", desc: "Auto-cite sources and build a research log as you browse", features: ["Auto citations", "Source ledger", "Export to Notion"], demand: 68, comp: 40, rev: "medium" },
  ];

  return concepts.map((c) => ({
    opportunity: `${titleBase} ${c.suffix}`,
    description: `${c.desc} for ${normalized} users.`,
    demand_score: c.demand,
    competition_score: c.comp,
    revenue_potential: c.rev,
    category: normalized,
    features: c.features,
  }));
};

const clampToRange = (arr: unknown, niche: string): unknown[] => {
  const list = Array.isArray(arr) ? arr.slice(0, 15) : [];
  if (list.length >= 10) return list;
  const filler = buildFallbackResults(niche);
  const seen = new Set(list.map((x) => (x as { opportunity?: string })?.opportunity));
  for (const f of filler) {
    if (list.length >= 10) break;
    if (!seen.has(f.opportunity)) list.push(f);
  }
  return list;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a Chrome extension market analyst. Analyze the "${niche}" market and discover between 10 and 15 profitable Chrome extension opportunities that don't exist yet or have weak competition. Return at least 10 distinct opportunities and no more than 15.

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

    // AI Orchestration: Delegate to the central ai-chat orchestrator
    const authHeader = req.headers.get("Authorization") ?? "";
    const orchestratorResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a Chrome extension market analyst. Return only valid JSON arrays. [Lovable AI Routed]" },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!orchestratorResponse.ok) {
      if (orchestratorResponse.status === 402 || orchestratorResponse.status === 503) {
        return new Response(JSON.stringify({
          warning: "AI credits or providers are currently unavailable. Showing fallback opportunities.",
          results: buildFallbackResults(niche),
          fallback: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Orchestrator error: ${orchestratorResponse.status}`);
    }

    const data = await orchestratorResponse.json();
    // ai-chat might return a stream or a single response depending on client implementation
    // for this utility, we expect the content in the first choice if it's been collected
    const content = data.choices?.[0]?.message?.content || data.content || "";
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

    return new Response(JSON.stringify({ results: clampToRange(results, niche) }), {
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
