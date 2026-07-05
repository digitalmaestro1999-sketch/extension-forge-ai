import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prompt, extension_name } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const iconPrompt = `App icon for a Chrome extension called "${extension_name ?? "Extension"}".
${prompt ?? "Modern, flat, geometric, memorable, single focal symbol."}
Style: flat design, bold geometric shapes, high contrast, vibrant single accent color on solid background, centered composition, generous padding, NO text, NO letters, NO logos of real brands, NO photorealism. Square 1:1 icon suitable for scaling down to 16x16. Simple enough to read at tiny sizes.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: iconPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json();
    const msg = data.choices?.[0]?.message ?? {};

    // Look for image in common response shapes
    let imageB64: string | null = null;
    if (Array.isArray(msg.images) && msg.images[0]?.image_url?.url) {
      const url = msg.images[0].image_url.url;
      imageB64 = url.startsWith("data:") ? url.split(",")[1] : url;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const url = part.image_url.url;
          imageB64 = url.startsWith("data:") ? url.split(",")[1] : url;
          break;
        }
        if (part.type === "output_image" && part.image?.data) { imageB64 = part.image.data; break; }
      }
    } else if (typeof msg.content === "string") {
      const m = msg.content.match(/data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)/);
      if (m) imageB64 = m[1];
    }

    if (!imageB64) throw new Error("No image returned from model");

    return new Response(JSON.stringify({ image_base64: imageB64, mime: "image/png" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
