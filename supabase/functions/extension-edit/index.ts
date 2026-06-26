import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type FileMap = Record<string, string>;
type Patch = { file: string; action: "update" | "create" | "delete"; content?: string; reason?: string };

const MAX_FILE_CHARS = 12000;
const MAX_TOTAL_CHARS = 60000;

function buildContext(files: FileMap): string {
  const names = Object.keys(files);
  let total = 0;
  const out: string[] = [];
  for (const name of names) {
    const body = (files[name] ?? "").slice(0, MAX_FILE_CHARS);
    const block = `--- FILE: ${name} ---\n${body}\n`;
    if (total + block.length > MAX_TOTAL_CHARS) {
      out.push(`--- FILE: ${name} ---\n[truncated: ${(files[name] ?? "").length} chars]\n`);
      continue;
    }
    total += block.length;
    out.push(block);
  }
  return out.join("\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  // sanitize literal newlines in strings
  return JSON.parse(raw);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { instruction, files, manifest, history } = (await req.json()) as {
      instruction: string;
      files: FileMap;
      manifest?: unknown;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!instruction || typeof instruction !== "string") {
      return new Response(JSON.stringify({ error: "instruction required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const fileList = Object.keys(files ?? {});
    const ctx = buildContext(files ?? {});

    const system = `You are an expert Chrome Extension (Manifest V3) editor.
You receive the FULL CURRENT SOURCE of an uploaded extension and a user instruction.
Your job: produce concrete code changes as a JSON patch.

Rules:
- Return STRICT JSON ONLY (no prose, no markdown fences) matching this shape:
  {
    "summary": "1-2 sentence human explanation",
    "patches": [
      { "file": "popup.html", "action": "update" | "create" | "delete", "content": "FULL NEW FILE CONTENTS", "reason": "why" }
    ]
  }
- For "update" or "create" you MUST include the COMPLETE new file content (not a diff).
- Only include files you actually changed. Keep changes minimal and focused.
- Preserve Manifest V3 compliance (no remote scripts, no eval, hardened CSP).
- If editing manifest.json, return valid JSON for its content.
- Prefer editing EXISTING files in: ${fileList.join(", ") || "(none)"}.
- Never invent unrelated features.`;

    const userMsg = `INSTRUCTION:
${instruction}

MANIFEST:
${JSON.stringify(manifest ?? {}, null, 2).slice(0, 4000)}

CURRENT SOURCE:
${ctx}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          ...((history ?? []).slice(-6)),
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error("ai gateway error", status, body);
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: status === 429 ? "Rate limit exceeded" : "Payment required" }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: { summary?: string; patches?: Patch[] };
    try {
      parsed = extractJson(text) as { summary?: string; patches?: Patch[] };
    } catch (e) {
      console.error("parse fail", e, text.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: text.slice(0, 2000) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patches = Array.isArray(parsed.patches) ? parsed.patches.filter((p) => p && typeof p.file === "string") : [];
    return new Response(
      JSON.stringify({ summary: parsed.summary ?? "Done.", patches }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extension-edit error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
