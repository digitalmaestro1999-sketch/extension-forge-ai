import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You perform competitive gap analysis for a Chrome extension against N direct competitors on the Chrome Web Store. Return ONLY valid JSON:
{
  "summary": "3-5 sentences positioning our extension vs the competitor set",
  "missingFeatures": [ { "feature": "…", "presentIn": ["competitor name", "…"], "impact": "high|medium|low", "effort": "small|medium|large" } ],
  "differentiators": [ { "feature": "…", "why": "…" } ],
  "opportunities": [ { "title": "…", "rationale": "…", "action": "…", "priority": "P0|P1|P2" } ],
  "threats": [ { "title": "…", "detail": "…", "mitigation": "…" } ],
  "keywords": [ { "keyword": "…", "usedByCompetitors": n, "recommend": true } ],
  "overallScore": 0-100  // our competitive position; higher = stronger differentiation, feature parity, review sentiment
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData.user) throw new Error("Unauthorized");
    const userId = userData.user.id;

    const { extensionName, description, manifest, category, competitorIds, projectId } = await req.json();
    if (!Array.isArray(competitorIds) || !competitorIds.length) throw new Error("competitorIds required");

    const { data: competitors, error: cErr } = await supabase
      .from("intel_cws_listings")
      .select("id,name,developer,rating,rating_count,user_count,permissions,features,short_description,detailed_description,review_sentiment,update_cadence")
      .in("id", competitorIds);
    if (cErr) throw cErr;

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const ourProfile = {
      name: extensionName,
      description,
      manifest: {
        permissions: manifest?.permissions ?? [],
        host_permissions: manifest?.host_permissions ?? [],
        name: manifest?.name,
        description: manifest?.description,
      },
    };

    const prompt = `Category: ${category ?? "unspecified"}

OUR EXTENSION:
${JSON.stringify(ourProfile).slice(0, 3000)}

COMPETITORS (${competitors?.length ?? 0}):
${JSON.stringify(competitors ?? []).slice(0, 12000)}

Produce an honest gap analysis. Prioritise concrete, shippable opportunities. Do not invent features that competitors don't actually list.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, please retry shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error(`AI gateway ${resp.status}: ${await resp.text()}`);

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const match = content.match(/\{[\s\S]*\}/);
    const analysis = match ? JSON.parse(match[0]) : {};

    const { data: report, error: iErr } = await supabase.from("intel_gap_reports").insert({
      user_id: userId,
      project_id: projectId ?? null,
      extension_name: extensionName ?? null,
      category: category ?? null,
      competitor_ids: competitorIds,
      summary: analysis.summary ?? null,
      missing_features: analysis.missingFeatures ?? [],
      differentiators: analysis.differentiators ?? [],
      opportunities: analysis.opportunities ?? [],
      threats: analysis.threats ?? [],
      keywords: analysis.keywords ?? [],
      overall_score: typeof analysis.overallScore === "number" ? Math.round(analysis.overallScore) : null,
      raw: analysis,
    }).select().single();
    if (iErr) throw iErr;

    return new Response(JSON.stringify({ report }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("intel-cws-gap-analysis:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
