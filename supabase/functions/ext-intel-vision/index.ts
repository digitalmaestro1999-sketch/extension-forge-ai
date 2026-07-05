import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GUARDRAIL =
  "Respect intellectual property. Produce ORIGINAL, non-infringing recommendations. Do NOT reproduce competitor code, copy, branding, logos, or proprietary implementation details. Return ONLY valid JSON.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { screenshot_url, competitor_name, report_id, competitor_id } = await req.json();
    if (!screenshot_url) throw new Error("screenshot_url required");
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const system = `You are a senior product designer analyzing a Chrome extension screenshot. ${GUARDRAIL}
Return JSON: {
  "uiLayout": string, "navigation": string, "typography": string, "spacing": string,
  "colorPalette": string[], "components": string[], "userJourney": string,
  "workflows": string[], "darkMode": boolean, "responsive": boolean,
  "strengths": string[], "weaknesses": string[],
  "wireframeDescription": string,
  "modernizationIdeas": string[]
}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: [
            { type: "text", text: `Analyze this UI screenshot of the "${competitor_name ?? "extension"}" Chrome extension.` },
            { type: "image_url", image_url: { url: screenshot_url } },
          ]},
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits required." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 300)}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const match = content.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : {};

    if (report_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
      );
      await supabase.from("intel_analyses").insert({
        report_id, competitor_id: competitor_id ?? null, module_key: "screenshots", payload: result,
      });
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
