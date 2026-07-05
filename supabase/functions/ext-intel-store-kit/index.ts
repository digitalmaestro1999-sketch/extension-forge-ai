import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You produce a complete, policy-compliant Chrome Web Store submission kit for an ORIGINAL Chrome extension. Do NOT copy competitor branding, copy, or logos.

Return ONLY valid JSON:
{
  "listing": {
    "title": "≤45 chars",
    "shortDescription": "≤132 chars, benefit-led",
    "detailedDescription": "600-1500 chars, markdown, features + benefits + how it works",
    "category": "one of: Productivity, Developer Tools, Accessibility, Communication, Education, Entertainment, News & Weather, Photos, Search Tools, Shopping, Social & Networking, Sports, Travel, Well-being",
    "keywords": string[] (10-15),
    "language": "en"
  },
  "privacyPolicy": "markdown — GDPR/CCPA compliant, plain English, covers data collected, purpose, storage, sharing, retention, user rights, contact",
  "permissionsJustification": [
    { "permission": "e.g. activeTab", "why": "one-sentence user-visible reason", "minimalAlternative": "or 'none'" }
  ],
  "singlePurpose": "one sentence describing the extension's single purpose (required by CWS policy)",
  "dataUsageDisclosure": {
    "collects": string[],
    "sells": false,
    "transfersToThirdParty": false,
    "usesForUnrelatedPurposes": false,
    "usesForCreditworthiness": false
  },
  "iconPrompt": "one-sentence prompt for a designer/AI to create a 128x128 icon — describe concept, colors, style (flat, geometric, no text, no logos)",
  "promoTileConcepts": [
    { "size": "440x280", "concept": "small tile visual concept, no copy" },
    { "size": "920x680", "concept": "marquee tile concept" },
    { "size": "1400x560", "concept": "hero tile concept" }
  ],
  "screenshots": [
    { "filename": "screenshot-1.png", "size": "1280x800", "caption": "≤80 chars", "content": "what to show" }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { blueprint, buildBetter, listing, competitor_name, category } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `Extension inspired by (not copying) "${competitor_name ?? "the category"}" in "${category ?? "Productivity"}".

BLUEPRINT: ${JSON.stringify(blueprint ?? {}).slice(0, 4000)}
BUILD-BETTER: ${JSON.stringify(buildBetter ?? {}).slice(0, 3000)}
COMPETITOR LISTING NOTES: ${JSON.stringify(listing ?? {}).slice(0, 1500)}

Produce a full Chrome Web Store submission kit. All copy must be original.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("AI gateway " + resp.status);

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const match = content.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : {};

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
