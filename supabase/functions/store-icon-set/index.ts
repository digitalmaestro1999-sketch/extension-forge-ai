import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates a hero icon (~1024x1024) and a promo tile (440x280) using
 * google/gemini-2.5-flash-image. Client resizes the icon into the standard
 * Chrome Web Store icon set (16/32/48/128).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const { name, description, style } = await req.json();
    if (!name) throw new Error("Extension name required");

    const styleHint = style ?? "modern flat geometric, bold single symbol, generous negative space, no text";

    const iconPrompt = `Design a Chrome Web Store extension icon for "${name}". ${description ? `Purpose: ${description}.` : ""} Style: ${styleHint}. Requirements: square, centered composition, high contrast, legible at 16x16, no lettering, no gradients heavier than two stops, on a solid colored background.`;
    const promoPrompt = `Design a Chrome Web Store small promo tile for "${name}" at 440x280 aspect ratio. ${description ? `Purpose: ${description}.` : ""} Style: ${styleHint}. Left third: the extension icon symbol. Right two-thirds: a soft product-lit background with subtle geometric motif. No text, no logos, no watermarks.`;

    const callImage = async (prompt: string) => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      if (r.status === 429) throw new Error("Rate limited by AI gateway. Please retry shortly.");
      if (r.status === 402) throw new Error("AI credits exhausted.");
      if (!r.ok) throw new Error(`AI gateway ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) throw new Error("No image returned by AI");
      return url;
    };

    const [iconDataUrl, promoDataUrl] = await Promise.all([callImage(iconPrompt), callImage(promoPrompt)]);
    return new Response(JSON.stringify({ iconDataUrl, promoDataUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("store-icon-set:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: /Rate limited/.test(msg) ? 429 : /credits/.test(msg) ? 402 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
