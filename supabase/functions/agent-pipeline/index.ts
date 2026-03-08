import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { spec, stage } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (stage === "code") {
      systemPrompt = `You are an expert Chrome Extension developer. Generate production-ready code for a Chrome extension based on the given specification. 
Return ONLY valid JSON with file contents. No markdown, no explanation.`;
      
      userPrompt = `Generate complete, production-ready Chrome extension code for:

Name: ${spec.name}
Description: ${spec.description}
Features: ${spec.features?.join(", ")}
Permissions: ${spec.permissions?.join(", ")}
APIs: ${spec.apis?.join(", ") || "None"}

Return JSON with this exact structure (all values must be strings of the file content):
{
  "manifest.json": "<full manifest.json content>",
  "background.js": "<full background service worker code implementing the features>",
  "content.js": "<full content script code that interacts with web pages>",
  "popup.html": "<full popup HTML with modern dark UI, Tailwind CDN, responsive 380px width>",
  "popup.js": "<full popup JavaScript with event listeners, chrome API calls, error handling>",
  "popup.css": "<full popup CSS with dark theme, modern design>",
  "options.html": "<options page HTML>",
  "options.js": "<options page JavaScript>",
  "styles.css": "<content script CSS if needed>",
  "utils/api.js": "<API helper functions>",
  "utils/storage.js": "<chrome.storage wrapper functions>"
}

Requirements:
- manifest.json must be valid Manifest V3
- background.js must use chrome.runtime, chrome.tabs, chrome.storage APIs as needed
- content.js must implement actual DOM manipulation for the extension's features
- popup must have a polished dark UI with status indicators, action buttons
- All chrome.runtime.sendMessage / onMessage patterns must be correctly implemented
- Include proper error handling everywhere
- Use async/await patterns
- popup.html should use inline Tailwind via CDN link for styling`;
    } else if (stage === "compliance") {
      systemPrompt = "You are a Chrome Web Store compliance expert. Analyze extensions for policy violations.";
      userPrompt = `Analyze this Chrome extension for Chrome Web Store compliance:

Name: ${spec.name}
Description: ${spec.description}
Permissions: ${spec.permissions?.join(", ")}
Host Permissions: ${spec.hostPermissions?.join(", ")}
Features: ${spec.features?.join(", ")}

Return JSON:
{
  "compliant": true/false,
  "score": 0-100,
  "issues": [{"severity": "error|warning|info", "category": "permissions|privacy|csp|manifest|policy", "message": "description", "fix": "how to fix"}],
  "privacyPolicy": "generated privacy policy text",
  "storeDescription": "optimized store listing description",
  "permissionJustifications": {"permission_name": "justification text"}
}`;
    } else if (stage === "security") {
      systemPrompt = "You are a security auditor for Chrome extensions.";
      userPrompt = `Perform a security audit on this Chrome extension:

Name: ${spec.name}
Permissions: ${spec.permissions?.join(", ")}
Host Permissions: ${spec.hostPermissions?.join(", ")}
Features: ${spec.features?.join(", ")}

Return JSON:
{
  "score": 0-100,
  "grade": "A|B|C|D|F",
  "findings": [{"severity": "critical|high|medium|low", "category": "permissions|csp|data|injection|api", "title": "short title", "description": "detail", "recommendation": "fix"}],
  "cspRecommendation": "recommended CSP policy string",
  "permissionAnalysis": {"permission": {"risk": "low|medium|high", "justification": "why needed", "alternative": "safer alternative if exists"}}
}`;
    } else if (stage === "store-assets") {
      systemPrompt = "You are a Chrome Web Store marketing expert.";
      userPrompt = `Generate Chrome Web Store listing assets for:

Name: ${spec.name}
Description: ${spec.description}
Features: ${spec.features?.join(", ")}

Return JSON:
{
  "title": "optimized store title (max 45 chars)",
  "summary": "short summary (max 132 chars)",
  "description": "full store description with formatting (max 16000 chars)",
  "category": "suggested Chrome Web Store category",
  "keywords": ["seo", "keywords"],
  "privacyPolicy": "full privacy policy text",
  "termsOfUse": "full terms of use text"
}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content.slice(0, 500));
      throw new Error("Failed to parse AI response");
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-pipeline error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
