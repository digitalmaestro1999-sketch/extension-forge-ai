// Public ingest endpoint for installed extensions.
// HMAC-authenticated using each install's secret token (sha256 hash stored server-side).
// Enforces: kill_switch, status (paused/revoked), license expiry, daily/weekly quotas, schedule windows.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-install-id, x-install-token, x-install-signature",
};

const enc = new TextEncoder();
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Schedule = { days?: number[]; start_hour?: number; end_hour?: number; tz?: string };

function isWithinSchedule(s: Schedule | null | undefined, now: Date): boolean {
  if (!s) return true;
  const day = now.getUTCDay() === 0 ? 7 : now.getUTCDay(); // 1..7 (Mon..Sun)
  if (s.days && s.days.length > 0 && !s.days.includes(day)) return false;
  if (typeof s.start_hour === "number" && typeof s.end_hour === "number") {
    const h = now.getUTCHours();
    if (s.start_hour <= s.end_hour) {
      if (h < s.start_hour || h >= s.end_hour) return false;
    } else {
      // crosses midnight
      if (h < s.start_hour && h >= s.end_hour) return false;
    }
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const installId = req.headers.get("x-install-id");
    const token = req.headers.get("x-install-token");
    if (!installId || !token) return json({ error: "missing auth headers" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: install, error } = await supabase
      .from("extension_installs")
      .select("*")
      .eq("id", installId)
      .maybeSingle();
    if (error || !install) return json({ error: "install not found" }, 404);

    const tokenHash = await sha256Hex(token);
    if (tokenHash !== install.token_hash) return json({ error: "invalid token" }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const eventType = String(body.event_type ?? "heartbeat");
    const actionName = body.action_name ? String(body.action_name) : null;
    const durationMs = typeof body.duration_ms === "number" ? body.duration_ms : null;
    const errorMessage = body.error_message ? String(body.error_message).slice(0, 2000) : null;
    const payload = body.payload && typeof body.payload === "object" ? body.payload : null;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // ---- Enforcement ----
    if (install.kill_switch) return policy("killed", "Extension has been remotely disabled.", install);
    if (install.status === "revoked") return policy("revoked", "License revoked.", install);
    if (install.status === "paused") return policy("paused", "Temporarily paused by owner.", install);
    if (install.license_expires_at && new Date(install.license_expires_at) < now) {
      return policy("expired", "License expired.", install);
    }
    if (!isWithinSchedule(install.schedule_json as Schedule | null, now)) {
      return policy("schedule", "Outside allowed usage window.", install);
    }

    // Quotas
    if (install.daily_quota_minutes != null || install.weekly_quota_minutes != null) {
      const since = new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 10);
      const { data: usageRows } = await supabase
        .from("extension_usage_daily")
        .select("day, minutes_used")
        .eq("install_id", installId)
        .gte("day", since);
      const today_min = usageRows?.find((r) => r.day === today)?.minutes_used ?? 0;
      const week_min = (usageRows ?? []).reduce((s, r) => s + (r.minutes_used ?? 0), 0);
      if (install.daily_quota_minutes != null && today_min >= install.daily_quota_minutes) {
        return policy("daily_quota", `Daily quota of ${install.daily_quota_minutes} min reached.`, install);
      }
      if (install.weekly_quota_minutes != null && week_min >= install.weekly_quota_minutes) {
        return policy("weekly_quota", `Weekly quota of ${install.weekly_quota_minutes} min reached.`, install);
      }
    }

    // ---- Record ----
    await supabase.from("extension_events").insert({
      install_id: installId,
      owner_id: install.owner_id,
      event_type: eventType,
      action_name: actionName,
      duration_ms: durationMs,
      error_message: errorMessage,
      payload,
    });

    // Update last_seen
    await supabase.from("extension_installs").update({ last_seen_at: now.toISOString() }).eq("id", installId);

    // Roll-up daily totals
    const minutesDelta = eventType === "heartbeat" ? Math.max(1, Math.round((durationMs ?? 60000) / 60000)) : 0;
    const actionsDelta = eventType === "action" ? 1 : 0;
    const errorsDelta = eventType === "error" ? 1 : 0;
    await supabase.rpc("noop").catch(() => {});
    // upsert via raw upsert
    const { data: existing } = await supabase
      .from("extension_usage_daily")
      .select("minutes_used, actions_count, errors_count")
      .eq("install_id", installId).eq("day", today).maybeSingle();
    if (existing) {
      await supabase.from("extension_usage_daily").update({
        minutes_used: (existing.minutes_used ?? 0) + minutesDelta,
        actions_count: (existing.actions_count ?? 0) + actionsDelta,
        errors_count: (existing.errors_count ?? 0) + errorsDelta,
      }).eq("install_id", installId).eq("day", today);
    } else {
      await supabase.from("extension_usage_daily").insert({
        install_id: installId, owner_id: install.owner_id, day: today,
        minutes_used: minutesDelta, actions_count: actionsDelta, errors_count: errorsDelta,
      });
    }

    return json({ allowed: true, status: install.status, next_check_seconds: 60 });
  } catch (e) {
    console.error("ingest err", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function policy(reason: string, message: string, install: { status: string }) {
  return json({ allowed: false, reason, message, status: install.status }, 200);
}
