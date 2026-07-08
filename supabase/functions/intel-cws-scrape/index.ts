import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";
const CWS_HOST = "chromewebstore.google.com";

async function fcScrape(url: string, formats: string[] = ["markdown", "links"]) {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats, onlyMainContent: true }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? `Firecrawl ${r.status}`);
  return data;
}

function extractCwsIdFromUrl(url: string): string | null {
  const m = url.match(/detail\/[^/]+\/([a-z]{32})/i) ?? url.match(/\/([a-z]{32})(?:[/?]|$)/i);
  return m ? m[1] : null;
}

function parseListingMarkdown(md: string): {
  name?: string; developer?: string; short?: string; detailed?: string;
  rating?: number; ratingCount?: number; userCount?: string;
  version?: string; lastUpdated?: string;
  permissions: string[]; features: string[]; reviews: string[];
} {
  const out = { permissions: [] as string[], features: [] as string[], reviews: [] as string[] } as ReturnType<typeof parseListingMarkdown>;
  const nameMatch = md.match(/^#\s+(.+?)$/m);
  if (nameMatch) out.name = nameMatch[1].trim();

  const ratingMatch = md.match(/([0-5](?:\.\d+)?)\s*(?:out of 5|stars?)?[^\d\n]{0,40}?\(?\s*([\d,]{1,10})\s*(?:ratings?|reviews?)/i)
                 ?? md.match(/([0-5]\.\d+)\s*\(\s*([\d,]+)\s*\)/);
  if (ratingMatch) {
    out.rating = parseFloat(ratingMatch[1]);
    out.ratingCount = parseInt(ratingMatch[2].replace(/,/g, ""), 10);
  }

  const users = md.match(/([\d,.]+\s*(?:\+|K|M)?)\s*users?/i);
  if (users) out.userCount = users[1];

  const version = md.match(/Version[:\s]*([0-9][0-9a-z.\-+]*)/i);
  if (version) out.version = version[1];

  const updated = md.match(/(?:Updated|Last updated)[:\s]*([A-Za-z0-9,\s]+?)(?:\n|$)/i);
  if (updated) out.lastUpdated = updated[1].trim();

  const dev = md.match(/(?:Offered by|Developer|By)[:\s]*([^\n]+)/i);
  if (dev) out.developer = dev[1].trim().slice(0, 120);

  // Permissions block
  const permBlock = md.match(/Permissions?[\s\S]{0,80}?(?:added|required|requested)?[:\s]*\n([\s\S]{0,1200}?)(?:\n\n|\n#|$)/i);
  if (permBlock) {
    out.permissions = permBlock[1]
      .split(/\n|,|•/)
      .map((s) => s.replace(/^[\s\-*•>]+/, "").trim())
      .filter((s) => s.length > 3 && s.length < 200)
      .slice(0, 20);
  }

  // Features: bullet-list under "Features" / "What's new" / "Overview"
  const feat = md.match(/(?:Features?|Highlights?|Overview)[\s\S]{0,20}?\n([\s\S]{0,1500}?)(?:\n\n#|\n#|$)/i);
  if (feat) {
    out.features = feat[1]
      .split(/\n/)
      .filter((l) => /^\s*[-*•]/.test(l))
      .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 25);
  }

  // Reviews: quoted blocks or lines starting with a star count
  const revRe = /(?:★{1,5}|\d\s*stars?)\s*[\-–:]?\s*([^\n]{20,400})/gi;
  let m: RegExpExecArray | null;
  while ((m = revRe.exec(md)) !== null && out.reviews.length < 20) {
    out.reviews.push(m[1].trim());
  }

  // First large text block as detailed description
  const paragraphs = md.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 80 && !p.startsWith("#"));
  if (paragraphs.length) {
    out.short = paragraphs[0].slice(0, 200);
    out.detailed = paragraphs.slice(0, 4).join("\n\n").slice(0, 4000);
  }

  return out;
}

async function summariseReviews(reviews: string[]): Promise<{ sentiment: string; themes: string[]; painPoints: string[]; praised: string[] } | null> {
  if (!reviews.length) return null;
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: 'Return ONLY JSON: {"sentiment":"positive|mixed|negative","themes":string[],"painPoints":string[],"praised":string[]}' },
        { role: "user", content: `Chrome extension reviews (${reviews.length}):\n\n${reviews.slice(0, 20).join("\n---\n").slice(0, 6000)}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content ?? "{}";
  const match = content.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

function estimateCadence(lastUpdated?: string): { lastUpdated?: string; daysSinceUpdate?: number; freshness?: string } {
  if (!lastUpdated) return {};
  const d = Date.parse(lastUpdated);
  if (isNaN(d)) return { lastUpdated };
  const days = Math.floor((Date.now() - d) / 86400000);
  const freshness = days < 30 ? "very-fresh" : days < 90 ? "fresh" : days < 365 ? "aging" : "stale";
  return { lastUpdated, daysSinceUpdate: days, freshness };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData.user) throw new Error("Unauthorized");
    const userId = userData.user.id;

    const { mode, url, category, limit } = await req.json();

    if (mode === "category") {
      // Scrape a CWS category page and return listing URLs, don't persist.
      const catUrl = url ?? `https://${CWS_HOST}/category/extensions/${category ?? "productivity"}`;
      const data = await fcScrape(catUrl, ["markdown", "links"]);
      const rawLinks: string[] = data?.data?.links ?? data?.links ?? [];
      const listingUrls = Array.from(new Set(rawLinks.filter((u) => /chromewebstore\.google\.com\/detail\//.test(u)))).slice(0, limit ?? 20);
      return new Response(JSON.stringify({ listingUrls, category }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "listing") {
      if (!url || !/chromewebstore\.google\.com\/detail\//.test(url)) throw new Error("Valid CWS detail URL required");
      const data = await fcScrape(url, ["markdown"]);
      const md: string = data?.data?.markdown ?? data?.markdown ?? "";
      if (!md) throw new Error("Empty scrape result");
      const parsed = parseListingMarkdown(md);
      const sentiment = await summariseReviews(parsed.reviews);
      const cadence = estimateCadence(parsed.lastUpdated);
      const cwsId = extractCwsIdFromUrl(url);

      const row = {
        user_id: userId,
        cws_url: url,
        cws_id: cwsId,
        category: category ?? null,
        name: parsed.name ?? null,
        developer: parsed.developer ?? null,
        short_description: parsed.short ?? null,
        detailed_description: parsed.detailed ?? null,
        rating: parsed.rating ?? null,
        rating_count: parsed.ratingCount ?? null,
        user_count: parsed.userCount ?? null,
        version: parsed.version ?? null,
        last_updated: parsed.lastUpdated ?? null,
        permissions: parsed.permissions,
        features: parsed.features,
        reviews: parsed.reviews,
        review_sentiment: sentiment,
        update_cadence: cadence,
        raw_markdown: md.slice(0, 20000),
        scraped_at: new Date().toISOString(),
      };
      const { data: inserted, error } = await supabase.from("intel_cws_listings").insert(row).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ listing: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("mode must be 'category' or 'listing'");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("intel-cws-scrape:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
