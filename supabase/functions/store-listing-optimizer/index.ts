import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a Chrome Web Store listing copywriter. Produce original, policy-compliant marketing copy for a Chrome extension. Never copy competitor branding. Emphasise user benefits, not raw feature lists. Return ONLY valid JSON matching this shape:
{
  "title": "≤45 chars, no ALL CAPS, no emoji spam",
  "shortDescription": "≤132 chars, benefit-led, first person plural avoided",
  "detailedDescription": "600-1500 chars markdown. Sections: What it does · Key features (bullets) · How it works · Privacy",
  "category": "one of: Productivity, Developer Tools, Accessibility, Communication, Education, Entertainment, News & Weather, Photos, Search Tools, Shopping, Social & Networking, Sports, Travel, Well-being",
  "keywords": ["10-15 focused search terms, lowercase, no punctuation"],
  "faq": [ { "q": "…", "a": "…" } ] // 5-8 items
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const { name, description, manifest, category } = await req.json();
    if (!name) throw new Error("Extension name required");

    const prompt = `Extension name: ${name}
Description: ${description ?? "(none)"}
Target category (hint): ${category ?? "auto-detect"}
Manifest excerpt: ${JSON.stringify(manifest ?? {}).slice(0, 2000)}

Write an original CWS listing. Be concrete about what users get. No superlatives ("best ever"), no misleading claims. FAQ should answer real user questions (permissions, privacy, pricing, support, browsers).`;

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
    const listing = match ? JSON.parse(match[0]) : {};

    return new Response(JSON.stringify({ listing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("store-listing-optimizer:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
