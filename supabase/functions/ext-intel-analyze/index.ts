import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GUARDRAIL =
  "Respect intellectual property. Produce ORIGINAL, non-infringing recommendations. Do NOT reproduce competitor code, copy, branding, logos, or proprietary implementation details. Return ONLY valid JSON.";

const STAGE_PROMPTS: Record<string, string> = {
  features: `Extract every feature from the extension description. ${GUARDRAIL}
Return JSON: {
  "main": string[], "sub": string[], "hidden": string[], "premium": string[],
  "ai": string[], "automation": string[], "integrations": string[],
  "export": string[], "import": string[], "cloud": string[],
  "auth": string[], "offline": string[], "notifications": string[],
  "customization": string[], "shortcuts": string[], "sync": string[],
  "accessibility": string[], "security": string[], "apis": string[],
  "tree": [{ "name": string, "children": string[] }]
}`,
  listing: `Analyze Chrome Web Store listing quality and SEO. ${GUARDRAIL}
Return JSON: {
  "titleScore": 0-100, "descriptionScore": 0-100, "seoScore": 0-100,
  "conversionScore": 0-100, "visibilityScore": 0-100,
  "keywords": string[], "keywordDensity": {[k:string]: number},
  "cta": string, "trustSignals": string[], "emotionalTriggers": string[],
  "improvements": string[]
}`,
  reviews: `Cluster user reviews into categories. ${GUARDRAIL}
Return JSON: {
  "positive": string[], "negative": string[], "neutral": string[],
  "featureRequests": string[], "bugReports": string[], "complaints": string[],
  "missingFeatures": string[], "pricingComplaints": string[],
  "performanceIssues": string[], "permissionComplaints": string[],
  "privacyConcerns": string[], "uiProblems": string[], "supportProblems": string[]
}`,
  sentiment: `${GUARDRAIL}
Return JSON: { "emotion": {[k:string]: number}, "satisfaction": 0-100, "frustrationIndex": 0-100, "featureDemandIndex": 0-100, "bugSeverity": 0-100, "marketHappiness": 0-100 }`,
  swot: `Generate SWOT. ${GUARDRAIL}
Return JSON: { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] }`,
  gaps: `Compare competitors and find feature gaps. ${GUARDRAIL}
Return JSON: { "missingFeatures": string[], "missingIntegrations": string[], "missingAutomation": string[], "missingAI": string[], "missingReports": string[], "missingUX": string[], "missingSecurity": string[], "missingExport": string[], "missingSync": string[], "missingAccessibility": string[], "summary": string }`,
  innovation: `Suggest brand-new innovative features never seen in this category. ${GUARDRAIL}
Return JSON: { "ideas": [{ "title": string, "description": string, "category": string, "novelty": 0-100, "impact": 0-100 }] }`,
  architecture: `Generate an original technical architecture for a superior extension. ${GUARDRAIL}
Return JSON: { "folderStructure": string, "manifest": object, "background": string, "popup": string, "options": string, "contentScripts": string, "messaging": string, "permissions": string[], "storage": string, "auth": string, "database": string, "apiLayer": string, "state": string, "security": string, "testing": string, "deployment": string }`,
  security: `Analyze permissions and security risk. ${GUARDRAIL}
Return JSON: { "securityScore": 0-100, "privacyScore": 0-100, "trustScore": 0-100, "riskyPermissions": [{ "name": string, "risk": "low"|"medium"|"high", "reason": string, "alternative": string }], "findings": string[] }`,
  monetization: `Identify monetization model and suggest better one. ${GUARDRAIL}
Return JSON: { "current": string[], "recommended": { "model": string, "pricing": string, "rationale": string }, "revenueProjection": string }`,
  ux: `Suggest UX redesign directions (original, non-copying). ${GUARDRAIL}
Return JSON: { "modernUI": string[], "navigation": string[], "colors": string[], "flow": string[], "accessibility": string[], "faster": string[] }`,
  prioritizer: `Prioritize a feature list with RICE, MoSCoW, and ICE. ${GUARDRAIL}
Return JSON: { "rice": [{ "feature": string, "reach": number, "impact": number, "confidence": number, "effort": number, "score": number }], "moscow": { "must": string[], "should": string[], "could": string[], "wont": string[] }, "ice": [{ "feature": string, "impact": number, "confidence": number, "ease": number, "score": number }] }`,
  blueprint: `Generate a complete PRD-style blueprint for a superior extension. ${GUARDRAIL}
Return JSON: { "prd": string, "technicalDesign": string, "roadmap": string, "sprintPlan": string, "marketingPlan": string, "launchPlan": string }`,
  buildBetter: `Create a differentiated 'better than this' plan. Do NOT copy — describe original improvements. ${GUARDRAIL}
Return JSON: { "missingFeatures": string[], "betterUX": string[], "betterUI": string[], "betterPricing": string, "betterArchitecture": string, "betterSEO": string[], "betterPerformance": string[], "betterSecurity": string[], "betterAI": string[], "betterAutomation": string[], "betterAccessibility": string[], "betterDashboard": string[], "betterReports": string[], "betterIntegrations": string[] }`,
  scorecard: `Score competitors 0-100 across dimensions. ${GUARDRAIL}
Return JSON: { "scores": { "features": number, "uiUx": number, "easeOfUse": number, "performance": number, "accessibility": number, "privacy": number, "security": number, "permissions": number, "ai": number, "automation": number, "integrations": number, "reviews": number, "popularity": number, "innovation": number, "seo": number, "monetization": number, "support": number, "documentation": number, "updateFrequency": number, "overall": number } }`,
  heatmap: `Build an opportunity heatmap. ${GUARDRAIL}
Return JSON: { "cells": [{ "niche": string, "aiReadiness": 0-100, "userDemand": 0-100, "competitionLevel": 0-100, "revenuePotential": 0-100, "complexity": 0-100 }] }`,
  prompts: `Generate production-ready dev prompts for the extension blueprint targeting each AI tool. ${GUARDRAIL}
Return JSON: { "lovable": string, "cursor": string, "windsurf": string, "claudeCode": string, "geminiCli": string, "copilot": string, "bolt": string, "replit": string }`,
  launch: `Generate a complete launch & marketing kit for a NEW, ORIGINAL Chrome extension inspired by (but not copying) the provided competitor context. Use the blueprint / buildBetter / listing context if present. All copy must be original, high-converting, and platform-native. ${GUARDRAIL}
Return JSON: {
  "positioning": { "tagline": string, "oneLiner": string, "elevatorPitch": string, "targetPersonas": string[], "uniqueValueProps": string[] },
  "productHunt": { "name": string, "tagline": string, "description": string, "firstComment": string, "makerComment": string, "gallery": string[], "topics": string[] },
  "tweets": { "launchThread": string[], "singleTweets": string[], "replyHooks": string[] },
  "reddit": [{ "subreddit": string, "title": string, "body": string, "flair": string }],
  "hackerNews": { "title": string, "showHnBody": string },
  "linkedin": { "founderPost": string, "companyPost": string, "articleTitle": string, "articleBody": string },
  "coldEmails": [{ "persona": string, "subject": string, "body": string }],
  "blogPost": { "title": string, "metaDescription": string, "slug": string, "markdown": string },
  "pressRelease": { "headline": string, "subheadline": string, "body": string, "boilerplate": string },
  "landingPageHtml": string,
  "launchChecklist": string[],
  "influencerOutreach": [{ "channel": string, "pitch": string }]
}
The landingPageHtml MUST be a complete, self-contained, mobile-responsive HTML page with inline CSS (no external assets, no scripts), including hero, features, CTA, footer.`,
  localize: `Localize a Chrome Web Store listing and landing copy into the requested target locales. Do NOT do word-for-word translation — adapt tone, idioms, cultural references, CTAs, and SEO keywords for each locale's Chrome Web Store market. Keep the same product meaning. ${GUARDRAIL}
Return JSON: {
  "locales": [{
    "locale": string,
    "languageName": string,
    "title": string,
    "shortDescription": string,
    "detailedDescription": string,
    "keywords": string[],
    "cta": string,
    "culturalNotes": string,
    "landingPageHtml": string
  }]
}
Each landingPageHtml MUST be a complete, self-contained, mobile-responsive HTML page with inline CSS (no external assets, no scripts) with lang attribute set correctly, including hero, features, CTA, footer. Title ≤45 chars, shortDescription ≤132 chars.`,
Return JSON: {
  "positioning": { "tagline": string, "oneLiner": string, "elevatorPitch": string, "targetPersonas": string[], "uniqueValueProps": string[] },
  "productHunt": { "name": string, "tagline": string, "description": string, "firstComment": string, "makerComment": string, "gallery": string[], "topics": string[] },
  "tweets": { "launchThread": string[], "singleTweets": string[], "replyHooks": string[] },
  "reddit": [{ "subreddit": string, "title": string, "body": string, "flair": string }],
  "hackerNews": { "title": string, "showHnBody": string },
  "linkedin": { "founderPost": string, "companyPost": string, "articleTitle": string, "articleBody": string },
  "coldEmails": [{ "persona": string, "subject": string, "body": string }],
  "blogPost": { "title": string, "metaDescription": string, "slug": string, "markdown": string },
  "pressRelease": { "headline": string, "subheadline": string, "body": string, "boilerplate": string },
  "landingPageHtml": string,
  "launchChecklist": string[],
  "influencerOutreach": [{ "channel": string, "pitch": string }]
}
The landingPageHtml MUST be a complete, self-contained, mobile-responsive HTML page with inline CSS (no external assets, no scripts), including hero, features, CTA, footer.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { stage, input, report_id, competitor_id } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const system = STAGE_PROMPTS[stage];
    if (!system) throw new Error(`Unknown stage: ${stage}`);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: typeof input === "string" ? input : JSON.stringify(input).slice(0, 15000) },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits required." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) throw new Error("AI gateway " + resp.status);

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const match = content.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : {};

    if (report_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
      );
      await supabase.from("intel_analyses").insert({
        report_id, competitor_id: competitor_id ?? null, module_key: stage, payload: result,
      });
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
