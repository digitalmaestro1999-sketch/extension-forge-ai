import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL = "https://api.firecrawl.dev/v2";
const STORE = "chromewebstore.google.com";

function extractChromeId(url: string): string | null {
  // .../detail/<slug>/<id>
  const m = url.match(/\/detail\/[^/]+\/([a-p]{32})/i) || url.match(/\/([a-p]{32})/i);
  return m ? m[1] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("FIRECRAWL_API_KEY");
    if (!key) throw new Error("FIRECRAWL_API_KEY not configured");

    const { input_type, input_value, limit = 10, report_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    // Build query
    let query = "";
    if (input_type === "url" || input_type === "chrome_id") {
      const id = input_type === "chrome_id" ? input_value : extractChromeId(input_value);
      query = `site:${STORE} ${id ?? input_value}`;
    } else {
      query = `site:${STORE} ${input_value}`;
    }

    const searchResp = await fetch(`${FIRECRAWL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: Math.min(50, limit) }),
    });
    if (!searchResp.ok) {
      const t = await searchResp.text();
      throw new Error(`Firecrawl search ${searchResp.status}: ${t.slice(0, 300)}`);
    }
    const searchData = await searchResp.json();
    const results = (searchData.data?.web || searchData.web || searchData.data || []) as any[];

    const competitors = results
      .filter((r) => r.url && r.url.includes("/detail/"))
      .slice(0, limit)
      .map((r, i) => ({
        report_id,
        chrome_id: extractChromeId(r.url),
        name: (r.title || "").replace(/ - Chrome Web Store$/i, "").trim() || "Unknown",
        url: r.url,
        rank: i + 1,
        raw: { description: r.description, snippet: r.snippet },
      }));

    if (report_id && competitors.length) {
      await supabase.from("intel_competitors").insert(competitors);
    }

    return new Response(JSON.stringify({ competitors, query }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
