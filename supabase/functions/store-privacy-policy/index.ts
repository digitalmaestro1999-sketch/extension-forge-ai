import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You draft plain-English, GDPR + CCPA compliant privacy policies for Chrome extensions. Justify each permission truthfully, describe data collected, purpose, storage, sharing, retention, user rights, and contact. Return ONLY valid JSON:
{
  "policyMarkdown": "full policy in markdown",
  "singlePurpose": "one sentence describing the extension's single purpose (CWS requirement)",
  "permissionsJustification": [
    { "permission": "activeTab", "why": "user-visible reason", "minimalAlternative": "or 'none'" }
  ],
  "dataUsageDisclosure": {
    "collects": ["personally identifiable info", "authentication", "..."],
    "sells": false,
    "transfersToThirdParty": false,
    "usesForUnrelatedPurposes": false,
    "usesForCreditworthiness": false
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const { name, description, manifest, contactEmail, developerName } = await req.json();
    if (!name) throw new Error("Extension name required");

    const permissions = manifest?.permissions ?? [];
    const hostPermissions = manifest?.host_permissions ?? [];

    const prompt = `Draft a privacy policy for the Chrome extension "${name}".
Description: ${description ?? "(none)"}
Developer: ${developerName ?? "the developer"}
Contact: ${contactEmail ?? "contact via the Chrome Web Store listing"}
Requested permissions: ${JSON.stringify(permissions)}
Host permissions: ${JSON.stringify(hostPermissions)}
Manifest excerpt: ${JSON.stringify(manifest ?? {}).slice(0, 1500)}

Rules:
- Be honest and specific — no boilerplate about data you don't actually collect.
- If the extension stores data only locally via chrome.storage.local, say so.
- List each permission and its real user-visible purpose.
- Cover: data collected, how it's used, sharing, retention, user rights (access/delete), children's data, contact.
- Effective date placeholder: {{EFFECTIVE_DATE}}.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, please retry shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error(`AI gateway ${resp.status}: ${await resp.text()}`);

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const match = content.match(/\{[\s\S]*\}/);
    const policy = match ? JSON.parse(match[0]) : {};
    if (policy.policyMarkdown) {
      policy.policyMarkdown = policy.policyMarkdown.replace(/\{\{EFFECTIVE_DATE\}\}/g, new Date().toISOString().slice(0, 10));
    }
    return new Response(JSON.stringify({ policy }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("store-privacy-policy:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
