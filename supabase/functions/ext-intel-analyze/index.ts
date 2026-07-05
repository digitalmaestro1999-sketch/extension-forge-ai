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
  growth: `Generate a complete POST-LAUNCH GROWTH OS for a NEW, ORIGINAL Chrome extension. Use the provided listing/launch/reviews context if present. All copy must be original, empathetic, on-brand, and directly usable. ${GUARDRAIL}
Return JSON: {
  "reviewResponses": {
    "fiveStar": [{ "trigger": string, "response": string }],
    "fourStar": [{ "trigger": string, "response": string }],
    "threeStar": [{ "trigger": string, "response": string }],
    "twoStar": [{ "trigger": string, "response": string }],
    "oneStar": [{ "trigger": string, "response": string }],
    "bugReport": [{ "trigger": string, "response": string }],
    "featureRequest": [{ "trigger": string, "response": string }],
    "permissionsConcern": [{ "trigger": string, "response": string }],
    "pricingComplaint": [{ "trigger": string, "response": string }]
  },
  "ratingsRecovery": { "playbook": string, "outreachTemplates": [{ "channel": string, "subject": string, "body": string }], "incentiveIdeas": string[] },
  "abListingVariants": [{ "hypothesis": string, "title": string, "shortDescription": string, "screenshotBrief": string, "successMetric": string }],
  "roadmap90d": { "month1": [{ "feature": string, "why": string }], "month2": [{ "feature": string, "why": string }], "month3": [{ "feature": string, "why": string }] },
  "changelogTemplates": [{ "version": string, "type": "feature"|"fix"|"perf"|"security", "markdown": string }],
  "supportMacros": [{ "topic": string, "macro": string }],
  "retentionEmails": [{ "trigger": string, "subject": string, "body": string, "sendAfter": string }],
  "reactivationEmails": [{ "trigger": string, "subject": string, "body": string }],
  "uninstallSurvey": { "questions": [{ "q": string, "options": string[] }], "followUpEmail": string },
  "asoRefreshCadence": { "weekly": string[], "monthly": string[], "quarterly": string[] },
  "upgradeCtas": [{ "surface": string, "copy": string, "cta": string }],
  "communityKit": { "discordAnnouncement": string, "slackAnnouncement": string, "changelogPost": string },
  "kpis": [{ "name": string, "target": string, "instrumentation": string }]
}`,
  legal: `Generate a complete LEGAL & COMPLIANCE VAULT for a NEW, ORIGINAL Chrome extension. Base it on the provided product/manifest/permissions context. All documents must be production-ready markdown, plain-English, and specific to a Chrome MV3 extension. Do NOT provide legal advice disclaimers as the primary content — write real, usable documents the operator can customize with company details. ${GUARDRAIL}
Return JSON: {
  "companyPlaceholders": { "companyName": string, "contactEmail": string, "jurisdiction": string, "effectiveDate": string },
  "privacyPolicy": { "title": string, "markdown": string, "wordCount": number },
  "termsOfService": { "title": string, "markdown": string },
  "cookiePolicy": { "title": string, "markdown": string, "usesCookies": boolean },
  "dataProcessingAgreement": { "title": string, "markdown": string },
  "gdprNotice": { "title": string, "markdown": string, "lawfulBasis": string[], "dataSubjectRights": string[] },
  "ccpaNotice": { "title": string, "markdown": string, "consumerRights": string[] },
  "dataHandlingDoc": { "title": string, "markdown": string, "dataCategories": [{ "category": string, "purpose": string, "retention": string, "sharedWith": string[] }] },
  "securityWhitepaper": { "title": string, "markdown": string, "controls": string[] },
  "soc2Checklist": [{ "control": string, "category": "security"|"availability"|"confidentiality"|"privacy"|"processing_integrity", "status": "ready"|"partial"|"todo", "action": string }],
  "cwsSinglePurpose": { "statement": string, "justification": string },
  "cwsPermissionJustifications": [{ "permission": string, "justification": string, "userBenefit": string, "minimalAlternative": string }],
  "cwsHostPermissionJustifications": [{ "host": string, "justification": string }],
  "cwsRemoteCodeStatement": string,
  "cwsDataUsageDisclosure": { "collectsPii": boolean, "categories": string[], "usageDeclarations": string[], "shareDeclarations": string[], "sellsData": boolean },
  "dmcaPolicy": { "title": string, "markdown": string },
  "acceptableUsePolicy": { "title": string, "markdown": string },
  "cookieBannerHtml": string,
  "consentModalHtml": string,
  "subprocessorList": [{ "name": string, "purpose": string, "location": string, "dataAccess": string }],
  "incidentResponsePlan": { "title": string, "markdown": string, "severityLevels": [{ "level": string, "definition": string, "sla": string }] },
  "dataBreachTemplate": { "userEmailSubject": string, "userEmailBody": string, "regulatorNotice": string }
}
Every markdown document MUST use {{companyName}}, {{contactEmail}}, {{jurisdiction}}, {{effectiveDate}} placeholders so the operator can search-and-replace.`,
  revenue: `Generate a complete MONETIZATION & REVENUE ENGINE for a NEW, ORIGINAL Chrome extension. Use the provided product/market/listing context. Everything must be original, high-converting, and specific to this product — no generic templates. ${GUARDRAIL}
Return JSON: {
  "strategy": { "recommendedModel": "freemium"|"free_trial"|"subscription"|"one_time"|"usage_based"|"lifetime"|"hybrid", "rationale": string, "expectedArpu": string, "expectedConversion": string, "expectedLtv": string, "expectedChurn": string },
  "pricingTiers": [{ "name": string, "monthlyPrice": number, "yearlyPrice": number, "targetPersona": string, "features": string[], "limits": { [k: string]: string }, "highlight": boolean, "cta": string, "positioning": string }],
  "pricingPageHtml": string,
  "paywallCopy": [{ "trigger": string, "headline": string, "subhead": string, "bullets": string[], "primaryCta": string, "secondaryCta": string, "socialProof": string }],
  "upsellFlows": [{ "trigger": string, "flow": string, "copy": string, "expectedLiftPct": number }],
  "downsellFlows": [{ "trigger": string, "offer": string, "copy": string }],
  "trialConversion": { "day": number, "channel": "in_app"|"email"|"push", "subject": string, "body": string }[],
  "checkoutCopy": { "pageTitle": string, "trustBadges": string[], "guarantees": string[], "faqs": [{ "q": string, "a": string }] },
  "receiptEmail": { "subject": string, "body": string },
  "dunningEmails": [{ "attempt": number, "sendDay": number, "subject": string, "body": string }],
  "renewalEmails": [{ "trigger": string, "subject": string, "body": string }],
  "cancellationFlow": { "surveyQuestions": [{ "q": string, "options": string[] }], "saveOffer": string, "confirmationEmail": { "subject": string, "body": string } },
  "referralProgram": { "userReward": string, "friendReward": string, "mechanics": string, "shareCopy": { "email": string, "twitter": string, "linkedin": string, "whatsapp": string }, "referralPageHtml": string },
  "affiliateProgram": { "commission": string, "cookieWindow": string, "payoutTerms": string, "recruitmentEmail": { "subject": string, "body": string }, "assets": string[] },
  "enterprisePitch": { "onePagerMarkdown": string, "pricingModel": string, "salesEmail": { "subject": string, "body": string }, "objectionResponses": [{ "objection": string, "response": string }] },
  "roiCalculator": { "inputs": [{ "name": string, "label": string, "type": "number"|"select", "defaultValue": string, "options": string[] }], "formula": string, "html": string },
  "stripeBlueprint": { "products": [{ "name": string, "priceId": string, "amount": number, "interval": "month"|"year"|"one_time" }], "webhookEvents": string[], "envVars": string[], "checkoutSessionCode": string, "portalSessionCode": string, "webhookHandlerCode": string },
  "paddleBlueprint": { "products": [{ "name": string, "priceId": string, "amount": number, "billingCycle": string }], "webhookEvents": string[], "envVars": string[], "checkoutCode": string, "webhookHandlerCode": string },
  "licenseKeySystem": { "schema": string, "activationFlowCode": string, "validationFlowCode": string, "revocationFlowCode": string },
  "billingFaq": [{ "q": string, "a": string }],
  "kpis": [{ "name": string, "target": string, "formula": string }]
}
pricingPageHtml, referralPageHtml, and roiCalculator.html MUST each be a complete, self-contained, mobile-responsive HTML page with inline CSS (no external assets, no external scripts).`,
  marketingSite: `Generate a complete MARKETING SITE + SEO PACK for a NEW, ORIGINAL Chrome extension. Use the provided product context. All pages must be complete, self-contained, mobile-responsive HTML with inline CSS (no external assets, no external scripts). All copy must be original, benefit-led, and SEO-optimized (real keywords used naturally). ${GUARDRAIL}
Return JSON: {
  "siteMeta": { "domain": string, "brandName": string, "tagline": string, "primaryKeyword": string, "secondaryKeywords": string[] },
  "pages": {
    "indexHtml": string,
    "featuresHtml": string,
    "pricingHtml": string,
    "aboutHtml": string,
    "contactHtml": string,
    "blogIndexHtml": string,
    "changelogHtml": string,
    "installHtml": string,
    "notFoundHtml": string
  },
  "blogPosts": [{ "slug": string, "title": string, "metaDescription": string, "keyword": string, "wordCount": number, "html": string, "readingTimeMinutes": number, "publishAt": string }],
  "comparisonPages": [{ "slug": string, "vsName": string, "title": string, "metaDescription": string, "html": string }],
  "jsonLd": { "organization": object, "softwareApplication": object, "faqPage": object, "breadcrumb": object },
  "sitemapXml": string,
  "robotsTxt": string,
  "opengraphSpec": { "title": string, "description": string, "imageBrief": string, "twitterCard": "summary_large_image" },
  "faviconBrief": string,
  "backlinkOutreach": [{ "targetType": "blog"|"newsletter"|"directory"|"podcast"|"reviewer"|"toolAggregator", "targetName": string, "subject": string, "body": string, "domainAuthorityBucket": "low"|"mid"|"high" }],
  "directoriesToSubmit": [{ "name": string, "url": string, "category": string, "priority": "high"|"medium"|"low" }],
  "keywordClusters": [{ "cluster": string, "primary": string, "supporting": string[], "intent": "informational"|"commercial"|"transactional"|"navigational" }],
  "internalLinkPlan": [{ "fromPage": string, "toPage": string, "anchor": string }],
  "seoChecklist": [{ "item": string, "status": "ready"|"todo", "priority": "high"|"medium"|"low" }]
}
IMPORTANT constraints:
- Every page in "pages" must be fully-formed HTML with <!doctype html>, <html lang="en">, <head> containing title, meta description, canonical, viewport, og:*, twitter:*, and JSON-LD script.
- Every blog post html must be a fully-formed HTML page with the same head requirements, an <article> body, and internal links to related posts / features / pricing.
- Every comparison page must be a fully-formed HTML page comparing the new product to the named competitor without disparagement or copying — objective feature-benefit framing only.
- Generate exactly 10 blogPosts and at least 3 comparisonPages.
- sitemapXml must reference every page (root pages + blog posts + comparison pages).`,
  analytics: `Generate a complete ANALYTICS & INSTRUMENTATION KIT for a NEW, ORIGINAL Chrome MV3 extension. Everything must be privacy-safe by default (no PII, opt-in consent, hashed user ids), specific to this product, and directly usable. Provide REAL executable code for the extension side (MV3 service worker + popup + content script). ${GUARDRAIL}
Return JSON: {
  "philosophy": { "principles": string[], "piiRules": string[], "retention": string, "optInFlow": string },
  "eventSchema": [{ "name": string, "trigger": string, "surface": "popup"|"background"|"content"|"options"|"onboarding"|"install"|"uninstall", "properties": [{ "key": string, "type": "string"|"number"|"boolean"|"enum", "example": string, "pii": boolean, "required": boolean }], "sampling": number }],
  "identity": { "anonIdStrategy": string, "userIdStrategy": string, "sessionRules": string, "code": string },
  "consentBanner": { "html": string, "storageKey": string, "gateCode": string },
  "extensionSnippets": {
    "trackerCoreTs": string,
    "backgroundTs": string,
    "popupTs": string,
    "contentTs": string,
    "onboardingTs": string,
    "uninstallHookTs": string
  },
  "adapters": {
    "ga4": { "envVars": string[], "code": string, "measurementProtocolNotes": string },
    "posthog": { "envVars": string[], "code": string },
    "plausible": { "envVars": string[], "code": string },
    "mixpanel": { "envVars": string[], "code": string },
    "selfHosted": { "endpoint": string, "code": string, "edgeFunctionCode": string, "sqlSchema": string }
  },
  "funnels": [{ "name": string, "steps": [{ "event": string, "windowMinutes": number }], "successCriterion": string }],
  "cohorts": [{ "name": string, "definition": string, "purpose": string }],
  "dashboards": [{ "name": string, "tool": "ga4"|"posthog"|"looker"|"metabase"|"custom", "widgets": [{ "title": string, "metric": string, "viz": "line"|"bar"|"pie"|"funnel"|"table"|"number" }] }],
  "sqlKpis": [{ "name": string, "sql": string, "dialect": "postgres"|"bigquery"|"clickhouse" }],
  "abTestFramework": {
    "assignmentCode": string,
    "experimentSchemaSql": string,
    "guardrailMetrics": string[],
    "sampleSizeGuidance": string,
    "exampleExperiments": [{ "name": string, "hypothesis": string, "variants": string[], "primaryMetric": string, "guardrails": string[] }]
  },
  "alerting": [{ "metric": string, "condition": string, "channel": "email"|"slack"|"webhook", "severity": "info"|"warn"|"critical" }],
  "dataDictionary": [{ "event": string, "property": string, "description": string, "example": string }],
  "privacyDisclosure": { "cwsFormAnswers": [{ "field": string, "answer": string }], "userFacingMarkdown": string },
  "instrumentationChecklist": [{ "item": string, "surface": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- All code must be TypeScript-flavored (ok to be .ts extension) targeting Chrome MV3 with \`chrome.storage.local\`, \`chrome.runtime\`, \`chrome.tabs\`, \`chrome.action\` — never window.localStorage in service workers.
- Do NOT include remote script imports; MV3 forbids them. Use fetch to first-party endpoints only.
- The self-hosted edgeFunctionCode must be a Deno Deploy / Supabase Edge Function style handler that validates payload, strips PII, and inserts into the sqlSchema.
- Consent banner must default to OFF and gate every tracker call.`,
  cicd: `Generate a complete CI/CD & AUTO-PUBLISH PIPELINE for a Chrome MV3 extension repo. Produce REAL, runnable files (GitHub Actions YAML, Node/TS scripts, JSON configs) — not summaries. Assume the repo already contains the extension source under \`extension/\` and uses npm. ${GUARDRAIL}
Return JSON: {
  "overview": { "philosophy": string, "branchStrategy": string, "environments": string[], "releaseCadence": string },
  "prerequisites": { "chromeWebStoreApi": { "steps": string[], "requiredSecrets": [{ "name": string, "purpose": string, "howToObtain": string }] }, "githubSecrets": [{ "name": string, "purpose": string }] },
  "workflows": {
    "ciYaml": string,
    "releaseYaml": string,
    "publishYaml": string,
    "nightlyYaml": string,
    "prPreviewYaml": string,
    "dependencyReviewYaml": string
  },
  "scripts": {
    "buildTs": string,
    "packageTs": string,
    "uploadToCwsTs": string,
    "publishOnCwsTs": string,
    "bumpVersionTs": string,
    "generateChangelogTs": string,
    "generateReleaseNotesTs": string,
    "regenerateScreenshotsTs": string,
    "preflightChecksTs": string,
    "manifestValidatorTs": string,
    "sizeBudgetCheckTs": string
  },
  "configs": {
    "packageJsonScripts": { [k: string]: string },
    "dependabotYml": string,
    "eslintConfig": string,
    "prettierConfig": string,
    "gitignore": string,
    "changesetsConfig": string,
    "releasePleaseConfig": string,
    "commitlintConfig": string,
    "huskyPreCommit": string,
    "sizeBudgetJson": string
  },
  "docs": {
    "contributingMd": string,
    "releasingMd": string,
    "troubleshootingMd": string,
    "prTemplateMd": string,
    "issueTemplateBug": string,
    "issueTemplateFeature": string,
    "codeownersFile": string,
    "securityMd": string
  },
  "releaseNotesTemplate": string,
  "changelogSeed": string,
  "versioningStrategy": { "scheme": "semver"|"calver", "rules": string, "prereleaseChannels": string[] },
  "smokeTests": [{ "name": string, "description": string, "code": string }],
  "puppeteerPreflight": { "description": string, "code": string },
  "cwsApiNotes": { "endpoints": [{ "method": string, "url": string, "purpose": string }], "quotaGuidance": string, "commonErrors": [{ "code": string, "cause": string, "fix": string }] },
  "rollbackPlan": { "markdown": string, "scriptTs": string },
  "matrixTesting": { "browsers": string[], "chromeChannels": string[], "notes": string },
  "monitoring": { "buildStatusBadgesMd": string, "slackNotifierCode": string },
  "checklist": [{ "item": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- All GitHub Actions YAML must be valid, pinned to major action versions (e.g. actions/checkout@v4), and include job-level permissions blocks.
- The upload script must use the official Chrome Web Store Publish API (https://www.googleapis.com/upload/chromewebstore/v1.1/items/{itemId}) with an OAuth refresh-token flow — no third-party npm wrappers unless standard.
- Every YAML/TS file must be complete and directly writable to disk with no placeholders like "// ...".
- Secrets must be read via \`process.env.*\` or \`\${{ secrets.* }}\` — never hardcoded.
- publishYaml must gate on tag push (v*) and require manual environment approval before actually pushing to public.`,
  supportHub: `Generate a complete SUPPORT & HELP CENTER KIT for a NEW, ORIGINAL Chrome MV3 extension. All content must be original, empathetic, specific to this product, and directly usable. HTML pages must be complete, self-contained, mobile-responsive with inline CSS, no external assets, no external scripts. ${GUARDRAIL}
Return JSON: {
  "overview": { "philosophy": string, "supportChannels": string[], "targetResponseTime": string, "targetResolutionTime": string, "tone": string },
  "helpCenter": {
    "indexHtml": string,
    "categories": [{ "slug": string, "title": string, "description": string, "articleSlugs": string[] }],
    "articles": [{ "slug": string, "categorySlug": string, "title": string, "metaDescription": string, "keywords": string[], "html": string, "estReadMinutes": number }],
    "searchIndexJson": string,
    "sitemapXml": string
  },
  "faq": {
    "pageHtml": string,
    "items": [{ "question": string, "answer": string, "category": string }],
    "jsonLd": string
  },
  "inAppHelp": {
    "widgetHtml": string,
    "widgetCss": string,
    "widgetJs": string,
    "contextualTooltips": [{ "surface": string, "selector": string, "tip": string, "trigger": "hover"|"click"|"first-visit" }],
    "onboardingChecklist": [{ "step": string, "description": string, "surface": string }]
  },
  "cannedResponses": [{ "id": string, "title": string, "trigger": string, "body": string, "tags": string[], "channel": "email"|"chat"|"cws-review" }],
  "ticketTemplates": {
    "bugReport": string,
    "featureRequest": string,
    "refundRequest": string,
    "accountIssue": string,
    "permissionsConcern": string,
    "dataDeletionRequest": string
  },
  "slaPolicy": { "markdown": string, "tiers": [{ "name": string, "responseTime": string, "resolutionTime": string, "hoursOfCoverage": string }] },
  "escalationPlaybooks": [{ "scenario": string, "severity": "p0"|"p1"|"p2"|"p3", "steps": string[], "owner": string, "commsTemplate": string }],
  "contactPage": { "html": string, "formFields": [{ "name": string, "label": string, "type": string, "required": boolean }] },
  "statusPage": { "html": string, "componentsToMonitor": [{ "name": string, "description": string, "checkType": string }], "incidentTemplateMd": string },
  "chatbotKnowledgeBase": { "systemPrompt": string, "intents": [{ "name": string, "utterances": string[], "response": string, "handoffToHuman": boolean }], "handoffRules": string[] },
  "reviewResponseTemplates": [{ "starRating": 1|2|3|4|5, "sentiment": string, "template": string }],
  "supportMetrics": [{ "name": string, "definition": string, "target": string, "sqlOrFormula": string }],
  "checklist": [{ "item": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- Help center articles must be REAL long-form content (300+ words each), not outlines. Include screenshots-suggested placeholders only where a screenshot is actually needed.
- Every HTML page must include proper <meta> tags (title, description, viewport, og:*) and semantic structure (header, main, footer, h1).
- Canned responses must be warm, non-templated-feeling, and include a specific placeholder like {{firstName}} or {{issueSummary}} where useful.
- Escalation playbooks must include concrete steps, not vague advice.
- chatbotKnowledgeBase.systemPrompt must be MV3-safe and never invent product capabilities.`,
  qaHarness: `Generate a complete QA & TEST HARNESS for a Chrome MV3 extension repo. Produce REAL, runnable files — actual test code, config, and CI wiring, not summaries. Assume the extension source is under \`extension/\` and the repo uses npm. Everything must be MV3-safe (no remote scripts, no eval, no external CDNs in the extension itself). ${GUARDRAIL}
Return JSON: {
  "overview": { "philosophy": string, "testPyramid": { "unit": string, "integration": string, "e2e": string }, "coverageTargets": { "statements": number, "branches": number, "functions": number, "lines": number }, "runFrequency": string },
  "toolingChoices": [{ "layer": string, "tool": string, "why": string }],
  "unit": {
    "framework": "vitest"|"jest",
    "configFile": string,
    "configContent": string,
    "setupFile": string,
    "setupContent": string,
    "chromeApiMockCode": string,
    "sampleTests": [{ "path": string, "description": string, "code": string }],
    "coverageConfigNotes": string
  },
  "integration": {
    "framework": string,
    "harnessCode": string,
    "sampleTests": [{ "path": string, "description": string, "code": string }],
    "notes": string
  },
  "e2ePlaywright": {
    "configFile": string,
    "configContent": string,
    "globalSetupCode": string,
    "extensionLoaderCode": string,
    "sampleSpecs": [{ "path": string, "description": string, "code": string }],
    "fixturesCode": string,
    "notes": string
  },
  "e2ePuppeteer": {
    "configNotes": string,
    "extensionLauncherCode": string,
    "sampleSpecs": [{ "path": string, "description": string, "code": string }]
  },
  "permissionFuzzer": {
    "philosophy": string,
    "fuzzerCode": string,
    "permissionMatrixJson": string,
    "sampleScenarios": [{ "name": string, "manifestPatch": string, "expectedOutcome": string }],
    "cspFuzzerCode": string,
    "messagingFuzzerCode": string
  },
  "accessibility": {
    "axeConfigCode": string,
    "popupAuditCode": string,
    "optionsAuditCode": string,
    "onboardingAuditCode": string,
    "reportRendererCode": string,
    "wcagLevel": "A"|"AA"|"AAA",
    "surfacesToAudit": string[]
  },
  "crossBrowserMatrix": {
    "targets": [{ "browser": string, "channel": string, "version": string, "notes": string }],
    "runnerCode": string,
    "githubMatrixYaml": string,
    "resultsAggregatorCode": string
  },
  "visualRegression": {
    "tool": string,
    "configCode": string,
    "sampleSpecs": [{ "path": string, "description": string, "code": string }],
    "baselineStrategy": string
  },
  "performance": {
    "budgetsJson": string,
    "lighthouseCiConfig": string,
    "popupTtiTestCode": string,
    "backgroundServiceWorkerBenchCode": string,
    "memoryLeakDetectorCode": string
  },
  "loadAndStress": {
    "storageStressTestCode": string,
    "messagingStormTestCode": string,
    "tabsBurstTestCode": string,
    "notes": string
  },
  "manifestAndCwsValidators": {
    "manifestValidatorCode": string,
    "cwsPolicyCheckerCode": string,
    "permissionMinimizerCode": string,
    "privacyLeakScannerCode": string
  },
  "mockFactories": {
    "chromeStorageMockCode": string,
    "chromeTabsMockCode": string,
    "chromeRuntimeMockCode": string,
    "chromeActionMockCode": string,
    "fetchMockCode": string
  },
  "smokeSuite": [{ "name": string, "surface": string, "description": string, "code": string }],
  "regressionSuite": [{ "name": string, "description": string, "code": string }],
  "flakyTestPolicy": { "markdown": string, "retryStrategy": string, "quarantineWorkflow": string },
  "reportGeneration": {
    "htmlReporterCode": string,
    "junitReporterNotes": string,
    "dashboardHtml": string,
    "slackDigestCode": string
  },
  "ciIntegration": {
    "githubWorkflowYaml": string,
    "requiredSecrets": [{ "name": string, "purpose": string }],
    "prCommentBotCode": string,
    "artifactRetentionNotes": string
  },
  "packageJsonScripts": { [k: string]: string },
  "checklist": [{ "item": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- All test/config code must be complete and directly writable to disk — no ellipses, no "// TODO" placeholders.
- Playwright specs must launch Chromium with the extension via \`--load-extension\` + \`--disable-extensions-except\`, in a persistent context (not headless-shell), because MV3 service workers need a real browser context.
- Puppeteer specs must use the same pattern and access the extension id via \`chrome://extensions\` scraping or the target's \`serviceWorker()\`.
- Chrome API mocks must cover \`chrome.storage.local\`, \`chrome.runtime.sendMessage\`, \`chrome.tabs.query\`, \`chrome.action.setBadgeText\` at minimum, and be usable in vitest via \`vi.stubGlobal("chrome", ...)\`.
- Permission fuzzer must actually mutate manifest.json permissions, rebuild, load, and assert extension still works or fails gracefully.
- Accessibility audits must use @axe-core/playwright and produce a JSON+HTML report; wcagLevel default is "AA".
- Cross-browser matrix must include Chrome stable + beta, Edge stable, Brave (via chromium binary), and note Firefox/Safari require separate MV2/MV3-hybrid ports.
- Every YAML must pin action versions (actions/checkout@v4, actions/setup-node@v4) and include job-level permissions blocks.`,
  securityAudit: `Generate a complete SECURITY & PRIVACY AUDIT PACK for a Chrome MV3 extension. Produce REAL, directly-usable deliverables (markdown reports, JSON matrices, Mermaid diagrams, runnable scripts) — never summaries. Everything must be MV3-safe and reflect real Chrome extension threat surfaces. ${GUARDRAIL}
Return JSON: {
  "overview": { "scope": string, "assumptions": string[], "outOfScope": string[], "auditorPersona": string, "executiveSummaryMd": string, "overallRiskRating": "low"|"medium"|"high"|"critical" },
  "cspHardening": {
    "currentCspAnalysisMd": string,
    "recommendedManifestCsp": { "extension_pages": string, "sandbox": string },
    "rationaleMd": string,
    "commonMistakes": [{ "mistake": string, "why": string, "fix": string }],
    "cspValidatorScript": string,
    "hardeningChecklist": [{ "item": string, "status": "todo"|"done", "priority": "high"|"medium"|"low" }]
  },
  "permissionMinimizer": {
    "currentPermissions": string[],
    "currentHostPermissions": string[],
    "analysis": [{ "permission": string, "purposeInferred": string, "risk": "low"|"medium"|"high", "canRemove": boolean, "canReplaceWith": string, "justification": string }],
    "recommendedManifestPatch": string,
    "activeTabMigrationGuideMd": string,
    "optionalPermissionsPlan": [{ "permission": string, "requestTrigger": string, "userFacingCopy": string }],
    "minimizerScript": string
  },
  "dataFlow": {
    "narrativeMd": string,
    "mermaidDiagram": string,
    "dataInventory": [{ "field": string, "source": string, "storedIn": string, "transmittedTo": string, "encryptionAtRest": string, "encryptionInTransit": string, "retention": string, "classification": "public"|"internal"|"pii"|"sensitive-pii" }],
    "thirdPartyEndpoints": [{ "url": string, "purpose": string, "dataSent": string, "necessity": "required"|"optional", "vendor": string }],
    "crossContextMessagingMap": [{ "from": string, "to": string, "channel": string, "payload": string, "trustBoundary": boolean }]
  },
  "dpia": {
    "documentMd": string,
    "processingActivities": [{ "activity": string, "lawfulBasis": string, "dataCategories": string[], "recipients": string[], "retention": string, "riskLevel": "low"|"medium"|"high" }],
    "dataSubjectRights": [{ "right": string, "howHandled": string, "responseSlaHours": number }],
    "riskRegister": [{ "risk": string, "likelihood": "low"|"medium"|"high", "impact": "low"|"medium"|"high", "mitigation": string, "residualRisk": "low"|"medium"|"high" }],
    "gdprAssessment": { "applies": boolean, "notesMd": string },
    "ccpaAssessment": { "applies": boolean, "notesMd": string }
  },
  "pia": {
    "documentMd": string,
    "purposeSpecification": string,
    "dataMinimizationEvidence": string[],
    "userConsentModelMd": string,
    "internationalTransfersMd": string
  },
  "threatModel": {
    "methodology": "STRIDE",
    "systemDescriptionMd": string,
    "trustBoundariesDiagram": string,
    "assets": [{ "name": string, "location": string, "sensitivity": "low"|"medium"|"high" }],
    "entryPoints": [{ "surface": string, "description": string, "authRequired": boolean }],
    "stride": [{ "component": string, "category": "S"|"T"|"R"|"I"|"D"|"E", "threat": string, "attackScenario": string, "impact": string, "likelihood": "low"|"medium"|"high", "existingMitigations": string[], "recommendedMitigations": string[], "residualRisk": "low"|"medium"|"high" }],
    "attackTreesMd": string,
    "abuseCases": [{ "actor": string, "goal": string, "steps": string[], "detection": string }]
  },
  "penTestChecklist": {
    "methodology": string,
    "environmentSetupMd": string,
    "tools": [{ "name": string, "purpose": string, "installCmd": string }],
    "checklist": [{ "id": string, "category": string, "item": string, "procedureMd": string, "expectedResult": string, "severityIfFails": "low"|"medium"|"high"|"critical", "reference": string }],
    "reportTemplateMd": string
  },
  "supplyChain": {
    "npmAuditNotesMd": string,
    "lockfileHygieneMd": string,
    "recommendedTools": [{ "name": string, "purpose": string }],
    "sbomGenerationScript": string,
    "dependabotYml": string,
    "pinnedActionsPolicyMd": string
  },
  "secretsAndStorage": {
    "storageInventory": [{ "key": string, "surface": string, "kind": "chrome.storage.local"|"chrome.storage.sync"|"chrome.storage.session"|"indexedDB"|"other", "sensitivity": string, "encryption": string }],
    "secretHandlingMd": string,
    "keyRotationMd": string,
    "secretScannerScript": string
  },
  "contentScriptIsolation": {
    "isolatedWorldNotesMd": string,
    "domXssAuditMd": string,
    "postMessageAuditMd": string,
    "sanitizerRecommendationsMd": string
  },
  "networkSecurity": {
    "allowedOrigins": string[],
    "corsExpectationsMd": string,
    "tlsRequirementsMd": string,
    "certPinningStanceMd": string
  },
  "incidentResponse": {
    "playbookMd": string,
    "severityMatrix": [{ "severity": "sev1"|"sev2"|"sev3"|"sev4", "definition": string, "responseTime": string, "commsChannel": string, "owner": string }],
    "vulnerabilityDisclosurePolicyMd": string,
    "securityTxt": string,
    "postmortemTemplateMd": string
  },
  "cwsPolicyMapping": {
    "policyChecklist": [{ "policyId": string, "policyName": string, "requirement": string, "howWeComply": string, "evidence": string, "status": "compliant"|"gap"|"na" }],
    "singlePurposeStatement": string,
    "permissionsJustificationMd": string,
    "remoteCodeAttestationMd": string,
    "userDataDisclosureForm": [{ "field": string, "answer": string }]
  },
  "browserExtensionOwaspTop10": [{ "id": string, "risk": string, "applicability": string, "mitigation": string, "status": "mitigated"|"partial"|"gap" }],
  "auditFindings": [{ "id": string, "title": string, "severity": "info"|"low"|"medium"|"high"|"critical", "cwe": string, "location": string, "descriptionMd": string, "reproductionSteps": string[], "impact": string, "remediation": string, "effort": "S"|"M"|"L", "status": "open"|"in-progress"|"fixed"|"accepted" }],
  "remediationRoadmap": [{ "phase": string, "duration": string, "items": string[] }],
  "signOffMd": string,
  "checklist": [{ "item": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- Mermaid diagrams must be valid \`graph TD\` / \`flowchart LR\` syntax with no emojis and no unescaped parentheses in node labels.
- The recommended CSP must forbid \`unsafe-eval\`, \`unsafe-inline\`, and any remote script/style origin — MV3 rejects them anyway; the report must explain why.
- Permission minimizer must prefer \`activeTab\` + \`optional_permissions\` + \`optional_host_permissions\` over broad \`<all_urls>\` or persistent host grants; every kept permission must have a real product-visible justification.
- STRIDE entries must be concrete to this extension's surfaces (popup, options, background service worker, content scripts, offscreen documents, side panel) — never generic web-app examples.
- Pen-test checklist must include extension-specific tests: manifest tampering, storage exfiltration via content script bridge, message spoofing from web pages, malicious update via CWS takeover, prototype pollution in bundled deps, DOM XSS in options page, activeTab abuse, and CSP bypass attempts.
- DPIA/PIA must be written in plain language a non-lawyer product owner can adopt, and must call out exactly which fields are PII, sensitive PII, or pseudonymous.
- Every script in the pack (validators, minimizer, secret scanner, SBOM generator) must be complete, standalone Node/TS files runnable with \`npx tsx <file>\` — no placeholders.
- security.txt must follow RFC 9116 and include Contact, Expires, Preferred-Languages, and Policy fields.`,
  feedbackLoop: `Generate a complete FEEDBACK LOOP & IN-EXTENSION REVIEW PROMPTS system for a Chrome MV3 extension. Produce REAL, runnable code (TS/HTML/CSS/SQL/YAML) plus operational playbooks — no summaries. Everything must be MV3-safe: no remote scripts, no eval, no external CDNs inside the extension, no PII sent without consent. ${GUARDRAIL}
Return JSON: {
  "overview": { "goals": string[], "kpis": [{ "metric": string, "target": string, "why": string }], "nonGoals": string[], "principlesMd": string, "successCriteriaMd": string },
  "smartReviewPrompt": {
    "strategyMd": string,
    "triggerRules": [{ "id": string, "name": string, "condition": string, "cooldownDays": number, "maxPromptsPerUser": number, "requiredValueMoments": number, "excludeIfNegativeSentiment": boolean }],
    "valueMomentEvents": [{ "event": string, "weight": number, "description": string }],
    "eligibilityScoringMd": string,
    "eligibilityScorerTs": string,
    "promptSchedulerTs": string,
    "chromeWebStoreDeepLinkPattern": string,
    "uiVariants": [{ "id": string, "surface": "popup"|"options"|"onboarding"|"sidepanel"|"inline-toast", "copyHeadline": string, "copyBody": string, "primaryCtaLabel": string, "secondaryCtaLabel": string, "dismissCtaLabel": string, "html": string, "css": string }],
    "abTestPlanMd": string,
    "antiSpamGuardrailsMd": string,
    "storageSchema": { "keys": [{ "key": string, "type": string, "purpose": string, "sensitive": boolean }] },
    "sampleTelemetryEvents": [{ "event": string, "props": string[] }]
  },
  "npsWidget": {
    "philosophyMd": string,
    "componentHtml": string,
    "componentCss": string,
    "componentTs": string,
    "followUpQuestions": { "promoter": string[], "passive": string[], "detractor": string[] },
    "sampleFrequencyRule": string,
    "scoreCalculationTs": string,
    "dashboardQuerySql": string,
    "chartSpecMd": string,
    "segmentationDimensions": string[]
  },
  "csatAndCes": {
    "csatWidgetHtml": string,
    "csatWidgetTs": string,
    "cesWidgetHtml": string,
    "cesWidgetTs": string,
    "microSurveyTriggersMd": string
  },
  "feedbackForm": {
    "formHtml": string,
    "formCss": string,
    "formTs": string,
    "categories": [{ "id": string, "label": string, "routing": string }],
    "attachmentSupportMd": string,
    "screenshotConsentFlowMd": string,
    "spamHeuristicsTs": string,
    "rateLimitingMd": string,
    "offlineQueueTs": string
  },
  "feedbackInbox": {
    "architectureMd": string,
    "databaseSchemaSql": string,
    "rlsPoliciesSql": string,
    "supabaseEdgeFunctionTs": string,
    "adminInboxReactTsx": string,
    "triageWorkflowMd": string,
    "statuses": [{ "id": string, "label": string, "next": string[] }],
    "prioritizationRubricMd": string,
    "slaMatrix": [{ "priority": "P0"|"P1"|"P2"|"P3", "firstResponseHours": number, "resolutionDays": number }],
    "autoTaggingRulesMd": string,
    "aiClusteringPromptMd": string,
    "duplicateDetectionTs": string,
    "sentimentPipelineMd": string,
    "webhookIntegrations": [{ "target": "slack"|"discord"|"linear"|"github"|"jira"|"notion"|"email", "payloadTemplate": string, "setupMd": string }]
  },
  "roadmapVoting": {
    "productSpecMd": string,
    "databaseSchemaSql": string,
    "rlsPoliciesSql": string,
    "voteWeightingRulesMd": string,
    "boardReactTsx": string,
    "itemCardReactTsx": string,
    "submitIdeaReactTsx": string,
    "statuses": [{ "id": "under-review"|"planned"|"in-progress"|"shipped"|"declined", "label": string, "color": string, "description": string }],
    "moderationPolicyMd": string,
    "antiBrigadingRulesMd": string,
    "changelogAutopostRulesMd": string,
    "publicApiSpecMd": string
  },
  "closeTheLoop": {
    "philosophyMd": string,
    "responseTemplates": [{ "id": string, "situation": string, "toneNotes": string, "template": string }],
    "shippedNotificationTs": string,
    "changelogGeneratorTs": string,
    "changelogFormatMd": string
  },
  "detractorRecovery": {
    "workflowMd": string,
    "detectionRulesMd": string,
    "outreachTemplates": [{ "channel": string, "subject": string, "body": string }],
    "escalationCriteriaMd": string,
    "refundOrCreditPolicyMd": string
  },
  "reviewMonitoring": {
    "cwsScrapingApproachMd": string,
    "alertRulesMd": string,
    "responsePlaybookMd": string,
    "replyTemplates": [{ "tone": "grateful"|"neutral"|"apology"|"technical", "template": string }],
    "kpiDashboardSpecMd": string
  },
  "privacyAndConsent": {
    "consentFlowMd": string,
    "consentDialogHtml": string,
    "consentDialogTs": string,
    "dataMinimizationRulesMd": string,
    "piiRedactionTs": string,
    "gdprNoticeMd": string,
    "ccpaNoticeMd": string,
    "userDataDeletionMd": string
  },
  "analytics": {
    "eventTaxonomy": [{ "event": string, "props": [{ "name": string, "type": string }], "purpose": string }],
    "funnelDefinitions": [{ "name": string, "steps": string[] }],
    "cohortDefinitions": [{ "name": string, "definition": string }],
    "dashboardSpecMd": string,
    "sampleQueriesSql": string[]
  },
  "aiFeedbackAgent": {
    "roleMd": string,
    "systemPrompt": string,
    "clusteringPrompt": string,
    "themingPrompt": string,
    "roadmapSuggestionPrompt": string,
    "weeklyDigestPrompt": string,
    "toolContract": [{ "tool": string, "description": string, "inputSchema": string }]
  },
  "manifestAdditions": { "permissions": string[], "hostPermissions": string[], "optionalPermissions": string[], "rationaleMd": string },
  "integrationGuideMd": string,
  "rolloutPlan": [{ "phase": string, "duration": string, "goals": string[], "guardrails": string[] }],
  "opsRunbookMd": string,
  "checklist": [{ "item": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- ALL widget HTML must be self-contained (no external CDN CSS/JS), CSP-safe (no inline event handlers — attach listeners in the accompanying TS), and use \`chrome.storage.local\` for state.
- The Chrome Web Store deep link pattern must use \`https://chromewebstore.google.com/detail/<id>/reviews\` (or the current CWS review URL) and open via \`chrome.tabs.create\`.
- Trigger rules must be concrete, event-based, and never prompt on first launch, error screens, or within N minutes of another prompt. Every rule needs a cooldown and a lifetime cap.
- NPS must follow the standard 0–10 scale, group promoters/passives/detractors correctly, and compute NPS = %promoters − %detractors.
- All SQL must target Supabase Postgres, include RLS policies, and never expose one user's feedback to another. Roadmap voting must prevent double-voting per user per item.
- Webhook payload templates must be real JSON strings ready to paste into Slack/Discord/Linear/etc., not placeholders.
- Privacy: never send raw feedback text to a third party without explicit consent, always allow user data deletion, and redact obvious PII (emails, tokens, URLs with query strings) before AI clustering.
- The AI feedback agent prompts must be usable as-is with an LLM and reference the actual event taxonomy and inbox schema you define elsewhere in this payload.
- Anti-brigading rules for roadmap voting must include per-account, per-IP, per-day caps and account-age minimums, described concretely.`,
  abExperiments: `Generate a complete A/B EXPERIMENTATION CONSOLE for a Chrome MV3 extension. Produce REAL, runnable code (TS/HTML/CSS/SQL/JSON) and operational playbooks — no summaries. Absolute constraints: MV3-SAFE (no remote JS, no eval, no external CDN JS/CSS bundled into the extension, no dynamic \`Function\` construction, no \`chrome.scripting.executeScript({ code: ... })\`). All "remote config" must be JSON-only feature flags/variant metadata fetched from a controlled server, cached in \`chrome.storage.local\`, cryptographically integrity-checked, and used purely as DATA that toggles code paths already shipped in the extension. ${GUARDRAIL}
Return JSON: {
  "overview": { "philosophyMd": string, "principles": string[], "nonGoals": string[], "kpis": [{ "metric": string, "target": string }], "cwsPolicyPositionMd": string, "mv3SafetyNotesMd": string },
  "experimentSpec": {
    "schemaJson": string,
    "schemaExplainedMd": string,
    "sampleExperimentsJson": string,
    "typesTs": string,
    "validationTs": string,
    "lintRulesMd": string
  },
  "remoteConfig": {
    "designMd": string,
    "endpointContractMd": string,
    "signedManifestFormatMd": string,
    "integrityVerifierTs": string,
    "clientFetcherTs": string,
    "cacheStrategyMd": string,
    "killSwitchMd": string,
    "staleWhileRevalidateTs": string,
    "sampleSignedManifestJson": string,
    "rotationPolicyMd": string
  },
  "assignment": {
    "algorithmMd": string,
    "hashingTs": string,
    "stickyBucketingMd": string,
    "trafficAllocationMd": string,
    "mutualExclusionMd": string,
    "holdoutsMd": string,
    "forcedAssignmentTs": string,
    "queryStringOverridesMd": string,
    "assignmentEngineTs": string,
    "unitTestsTs": string
  },
  "sdk": {
    "publicApiMd": string,
    "sdkTs": string,
    "reactHooksTs": string,
    "vanillaBindingsTs": string,
    "usageExamplesMd": string,
    "contentScriptSafetyMd": string,
    "serviceWorkerSafetyMd": string,
    "offlineBehaviorMd": string
  },
  "telemetry": {
    "eventTaxonomy": [{ "event": string, "props": [{ "name": string, "type": string }], "purpose": string }],
    "exposureLoggingTs": string,
    "metricEmissionTs": string,
    "deduplicationMd": string,
    "batchingAndFlushTs": string,
    "privacyMd": string,
    "consentIntegrationMd": string,
    "sampleClickstreamJson": string
  },
  "backend": {
    "architectureMd": string,
    "databaseSchemaSql": string,
    "rlsPoliciesSql": string,
    "supabaseEdgeFunctionsTs": [{ "name": string, "purpose": string, "code": string }],
    "ingestionPipelineMd": string,
    "materializedViewsSql": string,
    "retentionPolicyMd": string
  },
  "statistics": {
    "methodologyMd": string,
    "sampleSizeCalculatorTs": string,
    "sequentialTestingMd": string,
    "bayesianVsFrequentistMd": string,
    "cupedMd": string,
    "srmCheckTs": string,
    "guardrailMetricsMd": string,
    "significanceCalculatorTs": string,
    "confidenceIntervalTs": string,
    "multipleComparisonsMd": string
  },
  "dashboard": {
    "productSpecMd": string,
    "listViewTsx": string,
    "detailViewTsx": string,
    "resultsChartTsx": string,
    "exposureFunnelTsx": string,
    "assignmentDiagnosticsTsx": string,
    "createExperimentFormTsx": string,
    "statusStates": [{ "id": "draft"|"scheduled"|"running"|"paused"|"stopped"|"completed"|"archived", "label": string, "allowedTransitions": string[] }],
    "roleAndPermissionsMd": string,
    "decisionRecordTemplateMd": string
  },
  "experimentTypes": [
    { "id": string, "name": string, "whenToUseMd": string, "sampleConfigJson": string, "implementationNotesMd": string }
  ],
  "surfacesSupported": [{ "surface": "popup"|"options"|"onboarding"|"contentScript"|"sidepanel"|"background"|"newTab"|"offscreen", "notesMd": string }],
  "governance": {
    "reviewProcessMd": string,
    "prePreLaunchChecklistMd": string,
    "experimentRegistryMd": string,
    "namingConventionMd": string,
    "flagLifecycleMd": string,
    "cleanupPolicyMd": string,
    "auditLogSchemaSql": string
  },
  "safety": {
    "abuseAndAbortMd": string,
    "circuitBreakerTs": string,
    "userOptOutMd": string,
    "healthMonitorsMd": string,
    "rollbackPlaybookMd": string
  },
  "cwsCompliance": {
    "singlePurposeAlignmentMd": string,
    "remoteCodePolicyMd": string,
    "userDataDisclosureMd": string,
    "storeReviewerNoteMd": string
  },
  "manifestAdditions": { "permissions": string[], "hostPermissions": string[], "optionalPermissions": string[], "rationaleMd": string },
  "integrationGuideMd": string,
  "rolloutPlan": [{ "phase": string, "duration": string, "goals": string[], "guardrails": string[] }],
  "sampleExperimentPlaybooks": [{ "name": string, "hypothesis": string, "primaryMetric": string, "guardrailMetrics": string[], "variants": [{ "id": string, "description": string }], "readoutTemplateMd": string }],
  "opsRunbookMd": string,
  "checklist": [{ "item": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- Reiterate MV3 safety in code comments: variants MUST be metadata (booleans, numbers, strings, enum ids). Any code path a variant activates MUST already exist inside the shipped extension bundle.
- The remote-config fetcher MUST verify an Ed25519 (or equivalent) signature on the config payload before applying, cache the last-good version, and fall back to bundled defaults on failure.
- Assignment must be deterministic: \`bucket = hash(experimentId + saltedUnitId) % 10000\`; document the exact hash (e.g. FNV-1a or SHA-256 truncated) and show the TS implementation.
- Sticky bucketing must persist assignments in \`chrome.storage.local\` keyed by experimentId and honor them even after variant weights change, unless the experiment is reset.
- Exposure logging must fire exactly once per (unit, experiment, variant) per session boundary you define, and must be dedup-safe on the backend.
- SRM (sample ratio mismatch) check must actually implement a chi-squared test in TS, not describe it.
- SQL must target Supabase Postgres, include RLS so raw event rows are never readable by end-users, and expose only aggregated views to the dashboard role.
- Dashboard status transitions must be enforced in code, not just described.
- CWS reviewer note must explicitly state: no remote code is executed, remote config is data-only JSON with signed integrity, and all variant behavior ships in the reviewed bundle.
- Every script (verifier, assignment engine, SRM check, sample-size calc, significance calc) must be complete, standalone TS runnable with \`npx tsx <file>\` — no placeholders.`,
  communityEngine: `Generate a complete COMMUNITY & CONTENT ENGINE for a NEW, ORIGINAL Chrome extension inspired by (but never copying) the provided competitor context. Produce REAL, ready-to-use assets — full posts, full outreach emails, full editorial calendar entries, real subreddit/community targeting, tone-appropriate copy — never summaries or placeholders. Everything must be platform-native (respect each community's rules and tone) and non-spammy. ${GUARDRAIL}
Return JSON: {
  "overview": { "productPositioning": string, "targetAudiences": string[], "voiceAndTone": string, "brandPillars": string[], "goals": string[], "kpis": [{ "metric": string, "target": string }], "antiPatternsMd": string },
  "launchScheduler": {
    "narrativeMd": string,
    "recommendedLaunchDay": { "weekday": string, "reasoning": string },
    "timelineWeeks": number,
    "phases": [{ "phase": "prep"|"soft-launch"|"launch-day"|"post-launch"|"sustain", "startOffsetDays": number, "durationDays": number, "goals": string[], "channels": string[] }],
    "channelSchedule": [{
      "channel": "producthunt"|"hackernews"|"indiehackers"|"reddit"|"twitter"|"linkedin"|"devto"|"hashnode"|"medium"|"lobsters"|"betalist"|"microlaunch"|"peerlist"|"youtube"|"tiktok"|"substack"|"newsletter"|"discord"|"slack"|"facebook-group",
      "targetHandleOrCommunity": string,
      "scheduledOffsetHours": number,
      "postType": string,
      "hookHeadline": string,
      "postBody": string,
      "firstComment": string,
      "cta": string,
      "assetsNeeded": string[],
      "rulesChecklist": string[],
      "successCriteria": string
    }],
    "producthunt": { "productName": string, "tagline": string, "description": string, "topics": string[], "makerComment": string, "firstComment": string, "hunterOutreachTemplate": string, "gallerySpec": string[], "faqAnswers": [{ "q": string, "a": string }], "launchDayScheduleMd": string, "upvoteEthicsMd": string },
    "hackerNews": { "showHnTitle": string, "showHnBody": string, "commentReplyTemplates": [{ "situation": string, "reply": string }], "postingWindowUtc": string, "moderationDosAndDontsMd": string },
    "indieHackers": { "milestoneTitle": string, "milestoneBody": string, "productPageMd": string, "groupsToPostIn": string[], "founderStoryPost": string },
    "reddit": {
      "subredditPlan": [{ "subreddit": string, "audienceFit": string, "rulesSummary": string, "selfPromoRatioNotes": string, "bestDay": string, "bestTimeUtc": string, "flair": string, "postTitle": string, "postBody": string, "commentFirstReply": string, "modOutreachTemplate": string }],
      "amaPlanMd": string,
      "antiSpamPlaybookMd": string
    },
    "seedingCommunities": [{ "type": "discord"|"slack"|"circle"|"facebook-group"|"forum", "name": string, "url": string, "audienceFit": string, "introMessage": string, "rulesNotes": string }],
    "launchDayRunbookMd": string,
    "postLaunchFollowupsMd": string
  },
  "contentCalendar": {
    "strategyMd": string,
    "cadence": { "postsPerWeek": number, "cornerstonePerMonth": number, "socialPerDay": number },
    "pillarsBreakdown": [{ "pillar": string, "percent": number, "sampleTopics": string[] }],
    "weeks": [{
      "weekNumber": number,
      "theme": string,
      "days": [{
        "dayOfWeek": "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun",
        "items": [{ "channel": string, "format": "blog"|"tweet"|"thread"|"linkedin-post"|"short-video"|"long-video"|"newsletter"|"reddit"|"devto"|"hn"|"ih"|"changelog"|"case-study"|"tutorial", "workingTitle": string, "hook": string, "outline": string, "cta": string, "keywords": string[], "estimatedEffortHours": number, "assetsNeeded": string[] }]
      }]
    }],
    "seoTargetsMd": string,
    "repurposingRulesMd": string,
    "editorialWorkflowMd": string,
    "kanbanStates": [{ "id": "idea"|"draft"|"review"|"scheduled"|"published"|"analyzed", "label": string, "next": string[] }],
    "styleGuideMd": string,
    "briefTemplateMd": string,
    "distributionChecklistMd": string,
    "icalExportSampleMd": string
  },
  "outreachCrm": {
    "productSpecMd": string,
    "databaseSchemaSql": string,
    "rlsPoliciesSql": string,
    "supabaseEdgeFunctionsTs": [{ "name": string, "purpose": string, "code": string }],
    "contactSchema": [{ "field": string, "type": string, "purpose": string, "sensitive": boolean }],
    "segments": [{ "id": string, "label": string, "criteria": string }],
    "personas": [{ "id": string, "name": string, "role": string, "watering-holes": string[], "painPoints": string[], "objections": string[], "hooks": string[] }],
    "sequences": [{
      "id": string,
      "purpose": "launch-influencer"|"press"|"partnership"|"newsletter-swap"|"podcast-pitch"|"youtube-collab"|"customer-advocate"|"beta-tester",
      "channel": "email"|"twitter-dm"|"linkedin-dm"|"cold-comment",
      "steps": [{ "dayOffset": number, "subject": string, "body": string, "personalizationHints": string[] }]
    }],
    "influencerTiers": [{ "tier": "nano"|"micro"|"mid"|"macro"|"press", "followerRange": string, "outreachStrategy": string, "compensationNorms": string, "kpi": string }],
    "sourcingListsMd": string,
    "prospectingScriptTs": string,
    "replyClassifierPrompt": string,
    "followupCadenceMd": string,
    "compliance": { "canSpamMd": string, "gdprMd": string, "unsubscribeCopyMd": string },
    "trackingSchemaSql": string,
    "reportingViewsSql": string,
    "adminInboxReactTsx": string,
    "sequenceEditorReactTsx": string,
    "kpiDashboardReactTsx": string,
    "webhookIntegrations": [{ "target": "slack"|"discord"|"notion"|"linear"|"hubspot"|"email", "payloadTemplate": string, "setupMd": string }]
  },
  "prToolkit": {
    "pressReleaseMd": string,
    "boilerplate": string,
    "mediaKitMd": string,
    "journalistOutreachTemplate": string,
    "targetPublications": [{ "outlet": string, "beat": string, "reason": string, "pitchAngle": string }],
    "helpAReporterOutRepliesMd": string,
    "podcastPitches": [{ "podcast": string, "host": string, "angle": string, "email": string }]
  },
  "communityBuilding": {
    "philosophyMd": string,
    "recommendedPlatform": "discord"|"slack"|"circle"|"discourse",
    "channelsAndRolesMd": string,
    "welcomeSequenceMd": string,
    "codeOfConductMd": string,
    "moderationPlaybookMd": string,
    "engagementRitualsMd": string,
    "ambassadorProgramMd": string,
    "eventCalendarMd": string
  },
  "amplification": {
    "referralProgramMd": string,
    "affiliateProgramMd": string,
    "userGeneratedContentPromptsMd": string,
    "customerStoryTemplateMd": string,
    "reviewGenerationPlaybookMd": string
  },
  "analytics": {
    "eventTaxonomy": [{ "event": string, "props": [{ "name": string, "type": string }], "purpose": string }],
    "utmSchemeMd": string,
    "attributionModelMd": string,
    "dashboardSpecMd": string,
    "sampleQueriesSql": string[]
  },
  "safetyAndEthics": {
    "communityRulesRespectMd": string,
    "disclosureRequirementsMd": string,
    "antiSpamRulesMd": string,
    "brandSafetyMd": string,
    "rateLimitsMd": string
  },
  "manifestAdditions": { "permissions": string[], "hostPermissions": string[], "optionalPermissions": string[], "rationaleMd": string },
  "integrationGuideMd": string,
  "rolloutPlan": [{ "phase": string, "duration": string, "goals": string[], "guardrails": string[] }],
  "opsRunbookMd": string,
  "checklist": [{ "item": string, "priority": "high"|"medium"|"low", "status": "todo"|"ready" }]
}
IMPORTANT:
- Every Reddit entry MUST target a real, appropriate subreddit and reflect its self-promo rules. Never recommend blanket cross-posting.
- Product Hunt tagline max 60 chars; description ≤ 260 chars; use Pacific-time launch cadence in launchDayScheduleMd and warn against upvote manipulation.
- Hacker News: "Show HN:" title must follow HN guidelines (no marketing fluff, no "Show HN: We're excited to launch…"), body must be substantive, and reply templates must be humble/technical.
- Indie Hackers milestone must include real metrics language (MRR, WAU) and a genuine founder story, not a press release.
- Outreach sequences must be short (3–5 touches), personalization-first, include a soft opt-out line, and honor CAN-SPAM/GDPR — every email lists sender identity and unsubscribe copy.
- SQL must target Supabase Postgres, include RLS scoped to workspace/owner so one workspace's CRM data is never visible to another. Tracking tables must never store third-party PII beyond what the user explicitly imported.
- Webhook payload templates must be real JSON strings ready to paste into Slack/Discord/Notion/Linear/HubSpot, not placeholders.
- The content calendar must span at least 4 weeks with concrete titles, hooks, and CTAs — no "TBD" or "Content idea 1".
- Reference the Chrome extension product context (name, category, positioning) throughout — copy must not read as generic SaaS marketing.
- Amplification programs (referral/affiliate) must comply with Chrome Web Store policies (no incentivized fake reviews).`,
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
