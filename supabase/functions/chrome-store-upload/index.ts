// Chrome Web Store upload proxy.
// The user supplies their own Google OAuth credentials (client_id, client_secret,
// refresh_token) plus optional extension_id. This function exchanges the refresh
// token for an access token and uploads a base64-encoded ZIP to the CWS API.
//
// Docs: https://developer.chrome.com/docs/webstore/using-api
//
// Body: {
//   zipBase64: string,         // base64 of the .zip
//   clientId: string,
//   clientSecret: string,
//   refreshToken: string,
//   extensionId?: string,      // if omitted, creates a new draft listing
//   publish?: boolean,         // if true, also calls /publish after upload
//   publishTarget?: "default" | "trustedTesters",
// }

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

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
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
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Google OAuth failed: ${data.error_description || data.error || res.status}`);
  }
  return data.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      zipBase64,
      clientId,
      clientSecret,
      refreshToken,
      extensionId,
      publish = false,
      publishTarget = "default",
    } = body ?? {};

    if (!zipBase64) return json({ error: "zipBase64 is required" }, 400);
    if (!clientId || !clientSecret || !refreshToken) {
      return json({ error: "clientId, clientSecret and refreshToken are required" }, 400);
    }

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const zipBytes = base64ToBytes(zipBase64);

    // Upload: PUT for existing item, POST for new item
    const uploadUrl = extensionId
      ? `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`
      : `https://www.googleapis.com/upload/chromewebstore/v1.1/items`;

    const uploadRes = await fetch(uploadUrl, {
      method: extensionId ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-api-version": "2",
        "Content-Type": "application/zip",
      },
      body: zipBytes,
    });

    const uploadResult = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || uploadResult.uploadState === "FAILURE") {
      return json(
        {
          error: "Chrome Web Store upload failed",
          status: uploadRes.status,
          details: uploadResult,
        },
        502,
      );
    }

    const itemId: string | undefined = uploadResult.id ?? extensionId;
    let publishResult: any = null;

    if (publish && itemId) {
      const pubRes = await fetch(
        `https://www.googleapis.com/chromewebstore/v1.1/items/${itemId}/publish?publishTarget=${publishTarget}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-goog-api-version": "2",
            "Content-Length": "0",
          },
        },
      );
      publishResult = await pubRes.json().catch(() => ({}));
      if (!pubRes.ok) {
        return json(
          {
            error: "Upload succeeded but publish failed",
            uploadResult,
            publishStatus: pubRes.status,
            publishResult,
          },
          502,
        );
      }
    }

    return json({
      success: true,
      itemId,
      uploadResult,
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
