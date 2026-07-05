import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a senior Chrome extension engineer. Generate a COMPLETE, working Manifest V3 Chrome extension based on the provided blueprint.

STRICT RULES:
- Manifest V3 only. No remote scripts, no CDNs, no eval, no external network calls unless the blueprint requires an API — then use fetch().
- All CSS inline in <style> or as local files. All JS local.
- Must load cleanly via "Load unpacked" without errors.
- Do NOT copy competitor code, branding, copy, or logos. Produce ORIGINAL implementation.
- Include: manifest.json, popup.html, popup.js, popup.css, background.js, content.js (only if needed), README.md.
- Use chrome.storage.local (not localStorage) in the service worker.
- Icons are provided by the caller — reference "icon16.png", "icon48.png", "icon128.png" in manifest.

Return ONLY valid JSON in this exact shape:
{
  "name": "Extension name (short, original)",
  "description": "One-line description",
  "files": {
    "manifest.json": "…full JSON string…",
    "popup.html": "…",
    "popup.js": "…",
    "popup.css": "…",
    "background.js": "…",
    "README.md": "…"
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { blueprint, buildBetter, architecture, competitor_name, category } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const userPrompt = `Generate a superior, ORIGINAL Chrome extension inspired by (but not copying) "${competitor_name ?? "the category"}" in the "${category ?? "productivity"}" category.

BLUEPRINT:
${JSON.stringify(blueprint ?? {}, null, 2).slice(0, 6000)}

BUILD-BETTER PLAN:
${JSON.stringify(buildBetter ?? {}, null, 2).slice(0, 4000)}

ARCHITECTURE:
${JSON.stringify(architecture ?? {}, null, 2).slice(0, 4000)}

Build a real, functional MV3 extension. Popup must have working UI with at least one interactive feature. Background service worker must handle at least one chrome.* event. Keep it under ~400 lines total across files.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
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

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
