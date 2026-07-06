// Chrome Web Store automated upload / publish proxy.
//
// The user supplies their own Google OAuth credentials (CLIENT_ID,
// CLIENT_SECRET, REFRESH_TOKEN) — these are kept client-side in sessionStorage
// and forwarded per-request. We exchange them for an access token and call
// the official Chrome Web Store API.
//
// Operations (body.op):
//   "exchange-code"  -> swap a one-time OAuth `code` for a refresh_token
//                       (used by the in-app credential wizard)
//   "upload"         -> POST/PUT the .zip (create or update draft)
//   "status"         -> GET item resource (draft / review status)
//   "publish"        -> POST /publish  (default | trustedTesters)
//   "full"           -> upload -> poll status -> publish, in one call
//
// All errors return a structured JSON body so the UI can display fix-it hints.
// Docs: https://developer.chrome.com/docs/webstore/using-api

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CWS_API = "https://www.googleapis.com/chromewebstore/v1.1";
const CWS_UPLOAD_API = "https://www.googleapis.com/upload/chromewebstore/v1.1";

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google OAuth refresh failed (${res.status}): ${
        data.error_description || data.error || "unknown"
      }`,
    );
  }
  return data.access_token as string;
}

async function exchangeAuthCode(body: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: body.clientId,
      client_secret: body.clientSecret,
      code: body.code,
      redirect_uri: body.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.refresh_token) {
    return {
      ok: false,
      status: res.status,
      error:
        data.error_description ||
        data.error ||
        "Token exchange failed: no refresh_token returned. Make sure you used access_type=offline & prompt=consent, and that this auth code hasn't already been used.",
    };
  }
  return {
    ok: true,
    refreshToken: data.refresh_token as string,
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
    scope: data.scope as string,
  };
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const transient = /5\d\d|fetch failed|ECONN|timeout/i.test(String(e?.message));
      if (!transient || i === attempts - 1) throw e;
      console.warn(`[${label}] transient failure, retrying (${i + 1}/${attempts}):`, e?.message);
      await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

async function uploadZip(
  accessToken: string,
  zipBytes: Uint8Array,
  extensionId?: string,
) {
  const url = extensionId
    ? `${CWS_UPLOAD_API}/items/${extensionId}`
    : `${CWS_UPLOAD_API}/items`;
  const res = await fetch(url, {
    method: extensionId ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-goog-api-version": "2",
      "Content-Type": "application/zip",
    },
    body: zipBytes,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function getItem(accessToken: string, itemId: string) {
  const res = await fetch(
    `${CWS_API}/items/${itemId}?projection=DRAFT`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-api-version": "2",
      },
    },
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function publishItem(
  accessToken: string,
  itemId: string,
  target: "default" | "trustedTesters" = "default",
) {
  const res = await fetch(
    `${CWS_API}/items/${itemId}/publish?publishTarget=${target}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-api-version": "2",
        "Content-Length": "0",
      },
    },
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Map CWS uploadState / itemError codes to human guidance so the UI can
 * surface a specific fix instead of a generic 502.
 */
function summarizeUploadResult(data: any): { code: string; hint: string } | null {
  if (!data) return null;
  if (data.uploadState === "SUCCESS") return null;
  const errs: any[] = data.itemError ?? [];
  if (!errs.length) {
    return {
      code: data.uploadState ?? "UNKNOWN",
      hint: "Chrome Web Store rejected the package without details. Re-run QA + Auto-Fix and try again.",
    };
  }
  // Common ones:
  // ITEM_NOT_UPDATABLE — item is in review; wait until decision.
  // INVALID_DEVELOPER — refresh token belongs to a non-developer account.
  // MANIFEST_ERROR — manifest.json is invalid.
  const first = errs[0];
  const code = String(first.error_code ?? first.errorCode ?? "ERROR");
  const detail = String(first.error_detail ?? first.errorDetail ?? "");
  const hintMap: Record<string, string> = {
    ITEM_NOT_UPDATABLE:
      "This extension is currently in review. Wait for the previous submission to be approved or rejected before uploading a new version.",
    INVALID_DEVELOPER:
      "The OAuth account is not registered as a Chrome Web Store developer. Pay the $5 registration fee at chrome.google.com/webstore/devconsole first.",
    MANIFEST_ERROR:
      "manifest.json is invalid. Run /test to validate Manifest V3 fields before retrying.",
    INVALID_MANIFEST:
      "manifest.json is invalid. Run /test to validate Manifest V3 fields before retrying.",
    ITEM_NOT_FOUND:
      "The provided extensionId does not exist in this developer account. Leave it blank to create a new draft.",
  };
  return { code, hint: hintMap[code] ?? detail ?? "See CWS response for details." };
}

const MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MB hard cap on request body

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength && contentLength > MAX_BODY_BYTES) {
      return json({ error: "Payload too large (max 50 MB)" }, 413);
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "Payload too large (max 50 MB)" }, 413);
    }
    const body = JSON.parse(raw);
    const op: string = body?.op ?? "full";

    if (op === "exchange-code") {
      const result = await exchangeAuthCode({
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        code: body.code,
        redirectUri: body.redirectUri,
      });
      return json(result, result.ok ? 200 : 400);
    }

    const { clientId, clientSecret, refreshToken } = body;
    if (!clientId || !clientSecret || !refreshToken) {
      return json(
        { error: "clientId, clientSecret and refreshToken are required" },
        400,
      );
    }

    const accessToken = await withRetry("oauth", () =>
      getAccessToken(clientId, clientSecret, refreshToken),
    );

    if (op === "status") {
      if (!body.extensionId) return json({ error: "extensionId required" }, 400);
      const r = await getItem(accessToken, body.extensionId);
      return json(r, r.ok ? 200 : 502);
    }

    if (op === "publish") {
      if (!body.extensionId) return json({ error: "extensionId required" }, 400);
      const r = await publishItem(accessToken, body.extensionId, body.publishTarget);
      return json(
        {
          success: r.ok,
          status: r.status,
          publishResult: r.data,
          dashboardUrl: `https://chrome.google.com/webstore/devconsole/${body.extensionId}`,
        },
        r.ok ? 200 : 502,
      );
    }

    // upload | full
    if (!body.zipBase64) return json({ error: "zipBase64 is required" }, 400);
    const zipBytes = base64ToBytes(body.zipBase64);

    const upload = await withRetry("upload", () =>
      uploadZip(accessToken, zipBytes, body.extensionId),
    );

    const summary = summarizeUploadResult(upload.data);
    if (!upload.ok || summary) {
      return json(
        {
          error: "Chrome Web Store upload failed",
          status: upload.status,
          uploadResult: upload.data,
          hint: summary?.hint,
          code: summary?.code,
        },
        502,
      );
    }

    const itemId: string | undefined = upload.data.id ?? body.extensionId;
    let publishResult: any = null;

    if (op === "full" || body.publish) {
      if (!itemId) {
        return json({ error: "Upload returned no item id; cannot publish." }, 502);
      }
      // Brief pause — newly uploaded items occasionally 409 if published
      // immediately.
      await sleep(1500);
      const pub = await withRetry("publish", () =>
        publishItem(accessToken, itemId, body.publishTarget ?? "default"),
      );
      publishResult = pub.data;
      if (!pub.ok) {
        return json(
          {
            error: "Upload succeeded but publish failed",
            uploadResult: upload.data,
            publishStatus: pub.status,
            publishResult,
            itemId,
            dashboardUrl: `https://chrome.google.com/webstore/devconsole/${itemId}`,
          },
          502,
        );
      }
    }

    return json({
      success: true,
      itemId,
      uploadResult: upload.data,
      publishResult,
      dashboardUrl: itemId
        ? `https://chrome.google.com/webstore/devconsole/${itemId}`
        : "https://chrome.google.com/webstore/devconsole/",
    });
  } catch (e: any) {
    console.error("chrome-store-upload error:", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
