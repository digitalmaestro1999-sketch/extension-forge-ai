import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { idea, audience, functionality } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a Chrome extension architect. Given the following extension idea, generate a structured JSON specification.

Extension Idea: ${idea}
${audience ? `Target Audience: ${audience}` : ""}
${functionality ? `Core Functionality: ${functionality}` : ""}

Return ONLY valid JSON with this exact structure:
{
  "name": "Extension Name",
  "description": "Brief description",
  "features": ["feature1", "feature2", "feature3"],
  "permissions": ["permission1", "permission2"],
  "hostPermissions": ["https://*/*"],
  "apis": ["API1", "API2"]
}

Rules:
- permissions must be valid Chrome extension permissions (activeTab, tabs, storage, alarms, bookmarks, clipboardRead, clipboardWrite, downloads, history, notifications, scripting, webRequest, contextMenus)
- hostPermissions should be specific URLs when possible
- features should be 3-6 concise items
- name should be catchy and descriptive`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a Chrome extension architect. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    let spec;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        spec = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      // Fallback spec
      spec = {
        name: idea.slice(0, 30),
        description: idea,
        features: ["Core functionality", "User interface", "Settings page"],
        permissions: ["activeTab", "storage"],
        hostPermissions: ["https://*/*"],
        apis: [],
      };
    }

    return new Response(JSON.stringify({ spec }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-extension error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
