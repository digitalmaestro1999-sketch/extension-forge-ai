import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Escape raw control chars (\n, \r, \t, etc.) that appear *inside* JSON string
// literals. Required because LLMs frequently return file contents with literal
// newlines instead of \n, which breaks strict JSON.parse.
function sanitizeJsonControlChars(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else if (ch === "\b") out += "\\b";
        else if (ch === "\f") out += "\\f";
        else out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    out += ch;
  }
  return out;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { spec, stage } = await req.json();

    if (stage === "code") {
      return new Response(JSON.stringify({
        result: {},
        warning: "Using the hardened local Manifest V3 generator to avoid long AI code-generation timeouts.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    // NOTE: The `code` stage returns early above and delegates to the
    // deterministic client-side generator in `src/lib/generate-extension.ts`
    // (mirrored by wizard-codegen/quality-suite). Mirroring generateAllFiles()
    // server-side would duplicate hundreds of lines of templates for no user
    // benefit and reintroduce the 150s edge-timeout risk that motivated the
    // stub. This branch is intentionally unreachable; see the early return.
    if (stage === "compliance") {
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
    } else if (stage === "policy-fix") {
      // Tiny, targeted rewrite for a single failing CWS policy check.
      // `spec` carries: { kind, field?, permission?, manifest, listing, context }
      systemPrompt = "You are a Chrome Web Store compliance copy-editor. Rewrite the requested field so it passes the stated policy. Return ONLY valid JSON, no prose, no markdown.";
      const limits: Record<string, number> = {
        title: 45, summary: 132, description: 16000, singlePurpose: 300,
        name: 75, manifestDescription: 132,
      };
      const targetField = spec.field || spec.kind;
      const cap = limits[targetField] ?? 300;
      userPrompt = `Fix kind: ${spec.kind}
Field: ${spec.field ?? "(n/a)"}
Permission: ${spec.permission ?? "(n/a)"}
Max length: ${cap}

Extension manifest (truncated):
${JSON.stringify(spec.manifest ?? {}, null, 2).slice(0, 2000)}

Current listing:
${JSON.stringify(spec.listing ?? {}, null, 2).slice(0, 2000)}

Failing policy: ${spec.policy ?? ""}
Detail: ${spec.detail ?? ""}

Return JSON:
{
  "value": "the new value for the requested field, ≤${cap} chars, plain text, no markdown",
  "explanation": "1 short sentence why this fixes it"
}`;
    }

    // Retry on rate limits + empty/unparseable responses.
    // For the large code-generation stage, the client already merges AI output
    // with deterministic local templates. If the model emits malformed JSON, do
    // not fail the whole pipeline with a non-2xx response; return an empty AI
    // overlay so the local professional generator can complete the extension.
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
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        if (stage === "code") {
          const detail = await response.text().catch(() => "");
          console.warn("AI code overlay unavailable:", response.status, detail.slice(0, 500));
          return new Response(JSON.stringify({
            result: {},
            warning: "AI code overlay was unavailable, so the local production template generator was used.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
          const raw = jsonMatch[0];
          try {
            result = JSON.parse(raw);
          } catch {
            // AI often emits raw control chars (newlines/tabs) inside string
            // literals (file contents). Escape control chars only when we're
            // inside a JSON string, respecting backslash escapes.
            result = JSON.parse(sanitizeJsonControlChars(raw));
          }
          break;
        } else {
          console.warn("No JSON object found in response, retrying...");
        }
      } catch (parseError) {
        console.error("Parse error attempt", attempt, ":", parseError);
        // Large code-gen responses (~80k chars) take ~80s each; a second attempt
        // would blow past the 150s edge-function idle timeout. Fail fast.
        if (stage === "code") {
          return new Response(JSON.stringify({
            result: {},
            warning: "AI code overlay was malformed, so the local production template generator was used.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (attempt >= 1) {
          throw new Error("Failed to parse AI response");
        }
      }

    }

    if (!result) {
      if (stage === "code") {
        return new Response(JSON.stringify({
          result: {},
          warning: "AI code overlay was unavailable, so the local production template generator was used.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
