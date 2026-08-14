import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_SECRET = Deno.env.get("API_KEY_ENCRYPTION_KEY") ?? "";

async function getKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(ENC_SECRET);
  const digest = await crypto.subtle.digest("SHA-256", raw);
  return await crypto.subtle.importKey(
    "raw", digest, { name: "AES-GCM" }, false, ["decrypt"],
  );
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getKey();
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) }, key, b64decode(ciphertext),
  );
  return new TextDecoder().decode(buf);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { messages, provider } = await req.json();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("use_lovable_ai, selected_model_ids")
        .eq("user_id", user.id)
        .maybeSingle();

    const useLovable = profile?.use_lovable_ai ?? true;
    const favorites = profile?.selected_model_ids ?? [];

    let candidates = [];
    if (provider && provider !== "lovable_gateway") {
        candidates.push(provider);
    }
    // Only add unique favorites that aren't already the selected provider
    for (const fav of favorites) {
        if (!candidates.includes(fav)) {
            candidates.push(fav);
        }
    }

    const { data: allKeys } = await supabaseAdmin
        .from("user_api_keys")
        .select("*")
        .eq("user_id", user.id);

    async function tryRequest(keyId: string) {
        const keyData = allKeys?.find(k => k.id === keyId);
        if (!keyData) {
            console.warn(`Key data not found for candidate ID: ${keyId}`);
            return null;
        }

        const apiKey = await decrypt(keyData.ciphertext, keyData.iv);
        const svc = (keyData.service || "").toLowerCase();
        let apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        let model = "google/gemini-2.5-flash";
        let authType = "Bearer";

        if (keyData.base_url) {
            apiUrl = keyData.base_url.replace(/\/+$/, "") + "/chat/completions";
        } else {
            if (svc.includes("openai")) apiUrl = "https://api.openai.com/v1/chat/completions";
            else if (svc.includes("nvidia")) apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
            else if (svc.includes("google")) apiUrl = "https://generativelanguage.googleapis.com/v1beta/chat/completions";
        }

        if (keyData.model_id) {
            model = keyData.model_id;
        } else {
            if (svc.includes("openai")) model = "gpt-4o-mini";
            else if (svc.includes("nvidia")) model = "nvidia/llama-3.1-nemotron-70b-instruct";
            else if (svc.includes("google")) model = "gemini-1.5-flash";
        }

        if (svc.includes("google")) authType = "x-goog-api-key";
        else if (svc.includes("deepgram")) authType = "Token";

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authType === "x-goog-api-key") {
            headers["x-goog-api-key"] = apiKey;
        } else {
            headers["Authorization"] = `${authType} ${apiKey}`;
        }

        try {
            console.log(`Attempting request to ${svc} (${model}) at ${apiUrl}`);
            const resp = await fetch(apiUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: "system", content: `You are an expert Chrome extension developer assistant. Use Manifest V3 only.` },
                        ...messages,
                    ],
                    stream: true,
                }),
            });
            if (resp.ok) return resp;
            
            const errorText = await resp.text();
            console.warn(`Provider ${keyId} (${svc}) failed with status ${resp.status}: ${errorText.substring(0, 200)}`);
            return null;
        } catch (e) {
            console.error(`Fetch error for ${keyId} (${svc}):`, e);
            return null;
        }
    }

    // Try custom candidates first
    for (const cand of candidates) {
        const resp = await tryRequest(cand);
        if (resp) return new Response(resp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Fallback to all other available keys if candidates failed and Lovable is disabled
    if (!useLovable && allKeys && allKeys.length > 0) {
        for (const k of allKeys) {
            if (!candidates.includes(k.id)) {
                const resp = await tryRequest(k.id);
                if (resp) return new Response(resp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
            }
        }
    }

    // Finally try Lovable if enabled
    if (useLovable) {
        const apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
        try {
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [{ role: "system", content: `You are an expert Chrome extension developer assistant.` }, ...messages],
                    stream: true,
                }),
            });
            if (response.ok) return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
            console.error(`Lovable Gateway failed with status ${response.status}`);
        } catch (e) {
            console.error("Lovable Gateway fetch error:", e);
        }
    }

    return new Response(JSON.stringify({ 
        error: "No working AI models found among selected providers or favorites.",
        details: candidates.length > 0 ? "Check your API keys and model settings for the selected providers." : "Ensure you have added and selected at least one AI provider in the API Manager."
    }), { status: 503, headers: corsHeaders });

  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});