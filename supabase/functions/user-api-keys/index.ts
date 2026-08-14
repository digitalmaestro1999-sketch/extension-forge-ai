// User API-key vault: encrypts values at rest with AES-GCM and never returns
// plaintext except on an explicit "reveal" action for the authenticated owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ENC_SECRET = Deno.env.get("API_KEY_ENCRYPTION_KEY") ?? "";

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (!ENC_SECRET || ENC_SECRET.length < 16) {
    throw new Error("API_KEY_ENCRYPTION_KEY is not configured");
  }
  const raw = new TextEncoder().encode(ENC_SECRET);
  const digest = await crypto.subtle.digest("SHA-256", raw);
  cachedKey = await crypto.subtle.importKey(
    "raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"],
  );
  return cachedKey;
}

async function encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext),
  );
  return { ciphertext: b64encode(new Uint8Array(buf)), iv: b64encode(iv) };
}
async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getKey();
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) }, key, b64decode(ciphertext),
  );
  return new TextDecoder().decode(buf);
}

function hint(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "•".repeat(trimmed.length);
  return trimmed.slice(0, 4) + "…" + trimmed.slice(-4);
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "Not authenticated" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json(401, { error: "Not authenticated" });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "list");

    if (action === "list") {
      const { data, error } = await supabase
        .from("user_api_keys")
        .select("id, service, label, hint, base_url, model_id, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(200, { keys: data ?? [] });
    }

    if (action === "create") {
      const service = String(body?.service ?? "").trim().slice(0, 64);
      const label = String(body?.label ?? "").trim().slice(0, 120);
      const value = String(body?.value ?? "");
      const base_url = body?.base_url ? String(body.base_url).trim().slice(0, 512) : null;
      const model_id = body?.model_id ? String(body.model_id).trim().slice(0, 128) : null;

      if (!service || !label || !value) return json(400, { error: "Missing fields" });
      if (value.length > 4096) return json(400, { error: "Key too long" });
      const { ciphertext, iv } = await encrypt(value);
      const { data, error } = await supabase
        .from("user_api_keys")
        .insert({
          user_id: user.id,
          service, label, ciphertext, iv, hint: hint(value),
          base_url, model_id
        })
        .select("id, service, label, hint, base_url, model_id, created_at, updated_at")
        .single();
      if (error) throw error;
      return json(200, { key: data });
    }

    if (action === "proxy" || action === "health") {
      const id = String(body?.id ?? "");
      const path = String(body?.path ?? "");
      const method = String(body?.method ?? "GET");
      const proxyBody = body?.body;

      if (!id) return json(400, { error: "Missing id" });
      const { data, error } = await supabase
        .from("user_api_keys")
        .select("ciphertext, iv, service, base_url")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(404, { error: "Not found" });

      const value = await decrypt(data.ciphertext, data.iv);
      let url = data.base_url || "";
      
      // Default health/model paths if not provided
      const finalPath = path || (action === "health" ? "" : "/models");
      if (url && !url.endsWith("/") && finalPath && !finalPath.startsWith("/")) url += "/";
      const targetUrl = url + finalPath;

      if (!targetUrl.startsWith("http")) {
         return json(400, { error: "No base URL configured for this key" });
      }

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Basic auth injection based on service
        if (data.service.toLowerCase().includes("openai") || data.service.toLowerCase().includes("nvidia")) {
          headers["Authorization"] = `Bearer ${value}`;
        } else if (data.service.toLowerCase().includes("google")) {
          // Google often uses x-goog-api-key or ?key=
          headers["x-goog-api-key"] = value;
        } else if (data.service.toLowerCase().includes("deepgram")) {
          headers["Authorization"] = `Token ${value}`;
        } else {
          headers["Authorization"] = `Bearer ${value}`;
        }

        const resp = await fetch(targetUrl, {
          method,
          headers,
          body: proxyBody ? JSON.stringify(proxyBody) : undefined,
        });

        const respData = await resp.json().catch(() => ({}));
        return json(resp.status, respData);
      } catch (e) {
        return json(500, { error: `Proxy failed: ${e.message}` });
      }
    }

    if (action === "reveal") {
      const id = String(body?.id ?? "");
      if (!id) return json(400, { error: "Missing id" });
      const { data, error } = await supabase
        .from("user_api_keys")
        .select("ciphertext, iv")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(404, { error: "Not found" });
      const value = await decrypt(data.ciphertext, data.iv);
      return json(200, { value });
    }

    if (action === "delete") {
      const id = String(body?.id ?? "");
      if (!id) return json(400, { error: "Missing id" });
      const { error } = await supabase.from("user_api_keys").delete().eq("id", id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (err) {
    console.error("user-api-keys error", err);
    return json(500, { error: (err as Error).message });
  }
});
