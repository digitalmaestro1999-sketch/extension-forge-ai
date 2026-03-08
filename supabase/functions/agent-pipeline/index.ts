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
      systemPrompt = `You are an expert Chrome Extension developer specializing in Manifest V3. Generate production-ready, fully functional code.

CRITICAL RULES:
1. NEVER use external CDNs (no Tailwind CDN, no external scripts). All CSS must be inline/bundled. External scripts VIOLATE Manifest V3 Content Security Policy.
2. All popup/options CSS must use a professional dark theme with CSS custom properties.
3. All chrome.runtime.sendMessage / onMessage patterns must correctly return true for async responses.
4. Content scripts must implement ACTUAL functionality for the described features, not just placeholder TODO comments.
5. Background service workers must properly handle all message types.
6. Return ONLY valid JSON. No markdown, no explanation, no code fences.`;
      
      userPrompt = `Generate a complete, FUNCTIONAL Chrome extension:

Name: ${spec.name}
Description: ${spec.description}
Features: ${spec.features?.join(", ")}
Permissions: ${spec.permissions?.join(", ")}
APIs: ${spec.apis?.join(", ") || "None"}

Return JSON with this structure (all values are strings of file content):
{
  "manifest.json": "...",
  "background.js": "...",
  "content.js": "...",
  "popup.html": "...",
  "popup.js": "...",
  "styles.css": "...",
  "options.html": "...",
  "options.js": "..."
}

REQUIREMENTS:
- manifest.json: Valid Manifest V3. Icons at "icons/icon16.png", "icons/icon48.png", "icons/icon128.png". Content scripts must reference "content.js" and "content-styles.css". Action popup is "popup.html".
- popup.html: Must link to "styles.css" for styling. 380px width. NO external CDN links. Use semantic HTML.
- styles.css: Complete dark-theme CSS using CSS custom properties. Professional UI with:
  * Dark background (#09090b), elevated surfaces (#18181b), accent color (#6366f1)
  * Clean typography, proper spacing, rounded corners
  * Status indicators, hover states, smooth transitions
  * Scrollbar styling, focus states
  * 380px popup width, min-height 480px
- popup.js: Full event handling, chrome API calls, async/await, error handling. Wire up ALL buttons.
- background.js: Service worker with chrome.runtime.onInstalled, message handling, storage management. Must handle messages from content.js and popup.js.
- content.js: MUST implement actual DOM manipulation for the described features. Wrap in IIFE with double-injection guard. Must respond to messages with sendResponse.
- options.html: Full settings page with dark theme (inline CSS or link to a CSS file). Include toggles for enable/disable, notification preferences. NO external CDNs.
- options.js: Load/save settings with chrome.storage.local. Wire up all form elements.

The extension must ACTUALLY WORK when loaded in Chrome. Every button must do something. Every feature must have real implementation.`;
    } else if (stage === "compliance") {
      systemPrompt = "You are a Chrome Web Store compliance expert. Analyze extensions for policy violations. Return ONLY valid JSON.";
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
      systemPrompt = "You are a security auditor for Chrome extensions. Return ONLY valid JSON.";
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
      systemPrompt = "You are a Chrome Web Store marketing expert. Return ONLY valid JSON.";
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
    } else if (stage === "store-seo") {
      systemPrompt = "You are a Chrome Web Store SEO expert focused on maximizing extension visibility and installs. Return ONLY valid JSON.";
      userPrompt = `Optimize this Chrome extension for Chrome Web Store search:

Name: ${spec.name}
Description: ${spec.description}
Features: ${spec.features?.join(", ")}

Return JSON:
{
  "title": "SEO-optimized title (max 45 chars, include primary keyword)",
  "summary": "compelling short summary (max 132 chars)",
  "description": "full SEO-optimized store description with keywords naturally integrated",
  "keywords": ["primary keyword", "secondary keywords", "long-tail keywords"],
  "titleScore": 85,
  "tips": ["actionable SEO improvement tips"]
}`;
    }

    // Retry on rate limits + empty/unparseable responses
    let result;
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const isLastAttempt = attempt === maxAttempts - 1;
          if (!isLastAttempt) {
            const retryDelayMs = 1500 * Math.pow(2, attempt);
            console.warn(`AI rate limited (attempt ${attempt + 1}/${maxAttempts}), retrying in ${retryDelayMs}ms`);
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }

          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      const rawText = await response.text();
      if (!rawText || rawText.trim().length === 0) {
        console.warn("Empty response body from AI gateway, retrying...");
        continue;
      }
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (bodyParseErr) {
        console.warn("Failed to parse AI gateway response body, retrying...", bodyParseErr);
        continue;
      }
      const content = data.choices?.[0]?.message?.content || "";
      console.log("AI response length:", content.length, "attempt:", attempt);

      if (!content || content.trim().length === 0) {
        console.warn("Empty AI response, retrying...");
        continue;
      }

      try {
        // Try to extract JSON - handle markdown code fences
        let cleaned = content;
        const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
          cleaned = fenceMatch[1];
        }
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
          break;
        } else {
          console.warn("No JSON object found in response, retrying...");
        }
      } catch (parseError) {
        console.error("Parse error attempt", attempt, ":", parseError);
        if (attempt === 1) throw new Error("Failed to parse AI response after retries");
      }
    }

    if (!result) {
      throw new Error("Failed to get valid AI response after retries");
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
