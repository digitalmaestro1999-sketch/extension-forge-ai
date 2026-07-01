import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { summary, stage } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const stagePrompts: Record<string, string> = {
      recommendations:
        "You are a senior staff engineer. Analyze this project summary and return prioritized recommendations. Return ONLY JSON: { recommendations: [{ title, priority: 'critical'|'high'|'medium'|'low', category, effort: 'S'|'M'|'L', impact, roi: 1-10, steps: string[] }] }",
      refactor:
        "You are a refactoring expert. Given the summary of high-complexity files, propose concrete refactorings. Return ONLY JSON: { plans: [{ file, issue, plan, risk: 'low'|'medium'|'high', gains: string[] }] }",
      modernize:
        "You are a modernization consultant. Suggest stack/tooling upgrades and modern patterns to adopt. Return ONLY JSON: { upgrades: [{ area, current, recommended, reason, effort }] }",
      documentation:
        "You are a technical writer. Generate a concise architecture overview (Markdown) from this project summary. Return ONLY JSON: { markdown: string }",
    };

    const system = stagePrompts[stage] ?? stagePrompts.recommendations;
    const user = `Project summary:\n${JSON.stringify(summary).slice(0, 12000)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Credits required." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) throw new Error("AI gateway error " + resp.status);

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : { raw: content };

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
