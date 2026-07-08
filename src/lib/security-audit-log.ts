// Client-side security audit logger.
// Persists security-relevant events (preflight gates, downloads, uploads,
// auto-fixes, certifications) to the security_audit_logs table.
// Insert-only for users; superadmins can read all rows through RLS.

import { supabase } from "@/integrations/supabase/client";

export type AuditSeverity = "info" | "warning" | "error";

export type AuditEventType =
  | "preflight_pass"
  | "preflight_block"
  | "preflight_override"
  | "download"
  | "cws_upload"
  | "cws_upload_failed"
  | "autofix_applied"
  | "certify"
  | "manifest_edit"
  | "store_listing_generated"
  | "privacy_policy_generated"
  | "icon_set_generated";

export interface AuditPayload {
  eventType: AuditEventType;
  severity?: AuditSeverity;
  extensionName?: string | null;
  projectId?: string | null;
  passed?: boolean;
  blockers?: number;
  warnings?: number;
  details?: Record<string, unknown>;
}

export async function logSecurityEvent(payload: AuditPayload): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // RLS requires an authenticated user
    await supabase.from("security_audit_logs").insert({
      user_id: user.id,
      event_type: payload.eventType,
      severity: payload.severity ?? "info",
      extension_name: payload.extensionName ?? null,
      project_id: payload.projectId ?? null,
      passed: payload.passed ?? null,
      blockers: payload.blockers ?? 0,
      warnings: payload.warnings ?? 0,
      details: (payload.details ?? {}) as never,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch (err) {
    // Never let logging break user flows.
    console.warn("[security-audit-log] insert failed", err);
  }
}
