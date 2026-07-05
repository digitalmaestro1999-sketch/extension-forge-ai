import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL = "https://api.firecrawl.dev/v2";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("FIRECRAWL_API_KEY");
    if (!key) throw new Error("FIRECRAWL_API_KEY not configured");

    const { competitor_id, url, include_screenshot = true } = await req.json();
    if (!url) throw new Error("url required");

    const formats: any[] = ["markdown", "links"];
    if (include_screenshot) formats.push("screenshot");

    const scrapeResp = await fetch(`${FIRECRAWL}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats, onlyMainContent: false, waitFor: 2000 }),
    });
    if (!scrapeResp.ok) {
      const t = await scrapeResp.text();
      throw new Error(`Firecrawl scrape ${scrapeResp.status}: ${t.slice(0, 300)}`);
    }
    const data = await scrapeResp.json();
    const doc = data.data ?? data;
    const md: string = doc.markdown || "";

    const rating = md.match(/([0-9](?:\.[0-9])?)\s*(?:out of 5|stars?|\/\s*5)/i)?.[1];
    const reviews = md.match(/([\d,]+)\s+ratings?/i)?.[1] ?? md.match(/([\d,]+)\s+reviews?/i)?.[1];
    const users = md.match(/([\d,]+\+?)\s+users?/i)?.[1];
    const version = md.match(/Version\s*[:\s]\s*([\d.]+)/i)?.[1];
    const updated = md.match(/Updated\s*[:\s]\s*([A-Za-z0-9,\s]+?)(?:\n|$)/i)?.[1]?.trim();
    const developer = md.match(/(?:by|Offered by)\s+([^\n]+)/i)?.[1]?.trim();

    // Try to extract review-like blocks: lines with star counts + short text
    const reviewBlocks: string[] = [];
    const lines = md.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^★+/.test(line) || /rated \d out of 5/i.test(line)) {
        const chunk = lines.slice(i, i + 4).join(" ").trim();
        if (chunk.length > 20) reviewBlocks.push(chunk.slice(0, 500));
      }
    }

    const meta = {
      rating: rating ? Number(rating) : null,
      review_count: reviews ? Number(reviews.replace(/,/g, "")) : null,
      users_count: users ?? null,
      version: version ?? null,
      last_updated: updated ?? null,
      developer: developer ?? null,
      description: md.slice(0, 8000),
      reviews_raw: reviewBlocks.slice(0, 50),
      screenshot_url: doc.screenshot ?? null,
      links: (doc.links || []).slice(0, 80),
    };

    if (competitor_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
      );
      await supabase
        .from("intel_competitors")
        .update({
          rating: meta.rating,
          review_count: meta.review_count,
          users_count: meta.users_count,
          developer: meta.developer,
          raw: meta,
        })
        .eq("id", competitor_id);
    }

    return new Response(JSON.stringify({ meta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
