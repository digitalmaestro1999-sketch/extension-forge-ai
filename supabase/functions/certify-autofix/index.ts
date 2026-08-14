// Certification auto-fix edge function.
// Given a single extension file and its issues, calls Lovable AI Gateway
// (google/gemini-2.5-pro) and returns the rewritten file content.
//
// Request:  { file: string, content: string, issues: Array<{id,severity,message,fix,line?}> }
// Response: { content: string, changed: boolean }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Issue {
  id: string;
  severity: string;
  message: string;
  fix: string;
  line?: number;
  category?: string;
}

function buildPrompt(file: string, content: string, issues: Issue[]): { system: string; user: string } {
  const isJson = /\.json$/i.test(file);
  const isHtml = /\.html?$/i.test(file);
  const isJs = /\.(js|mjs)$/i.test(file);
  const kind = isJson ? "JSON" : isHtml ? "HTML" : isJs ? "JavaScript" : "text";

  const system = `You are an expert Chrome Extension (Manifest V3) engineer.
You rewrite ${kind} files to eliminate specific compliance, security, or syntax issues
while preserving all original functionality. Rules:
- Manifest V3 only. Never introduce remote code, eval, new Function, or inline scripts.
- CSP-safe: no unsafe-inline / unsafe-eval directives.
- Keep the file's public API, exported names, event listeners, and DOM structure intact.
- Do NOT add commentary, backticks, or markdown fences.
- Return ONLY the complete rewritten file content.`;

  const issueList = issues
    .map((i, idx) => `${idx + 1}. [${i.severity.toUpperCase()}] ${i.message}\n   Fix hint: ${i.fix}${i.line ? `\n   Near line: ${i.line}` : ""}`)
    .join("\n");

  const user = `Rewrite \`${file}\` to fix the following issues:\n\n${issueList}\n\n=== CURRENT FILE ===\n${content}\n=== END FILE ===\n\nReturn ONLY the rewritten file content — no explanations, no fences.`;
  return { system, user };
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
  return fenced ? fenced[1] : text.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file, content, issues } = await req.json() as {
      file: string; content: string; issues: Issue[];
    };
    if (!file || typeof content !== "string" || !Array.isArray(issues) || issues.length === 0) {
      return new Response(JSON.stringify({ error: "file, content, and non-empty issues[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { system, user } = buildPrompt(file, content, issues);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("certify-autofix gateway error", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in your workspace billing." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error", details: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const rewritten = stripFences(String(raw));
    if (!rewritten) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      content: rewritten,
      changed: rewritten.trim() !== content.trim(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("certify-autofix error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
