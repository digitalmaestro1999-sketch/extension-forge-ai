
# AI Chrome Extension Intelligence Engine — Implementation Plan

Replaces the current Software Intelligence page with a full competitive intelligence platform for Chrome extensions. Uses Firecrawl (scraping) + Lovable AI (Gemini) for analysis. Nothing scraped is copied verbatim — outputs are differentiated blueprints.

## Legal & IP guardrails (baked into every module)

- Never emit competitor code, copy, screenshots, or logos into user deliverables.
- AI prompts include: "Produce original, non-infringing recommendations. Do not reproduce competitor text, branding, or proprietary implementation."
- Store raw scraped data server-side (analysis input only), surface only derived insights.
- "Build Better Than This" outputs a differentiated PRD, not a clone.

## Architecture

```text
User input (keyword | category | Store URL | Chrome ID)
        │
        ▼
┌─────────────────────────────────────────────┐
│ Page: /intelligence  (tabs = 20 modules)    │
└─────────────────────────────────────────────┘
        │ invoke
        ▼
┌─────────────────────────────────────────────┐
│ Edge functions                              │
│  • ext-intel-discover  (Firecrawl search)   │
│  • ext-intel-scrape    (Firecrawl scrape)   │
│  • ext-intel-analyze   (Gemini, stage-based)│
│  • ext-intel-export    (PDF/CSV/MD/JSON)    │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ DB: intel_reports, intel_competitors,       │
│     intel_analyses (jsonb per module)       │
└─────────────────────────────────────────────┘
```

Reuse: existing `agent-pipeline` stage pattern, Firecrawl client shape from knowledge, Lovable AI gateway helper.

## Data model (new tables, RLS by owner)

- `intel_reports` — id, user_id, input_type, input_value, status, created_at
- `intel_competitors` — id, report_id, chrome_id, name, developer, rating, users, url, raw jsonb (metadata + screenshots urls)
- `intel_analyses` — id, report_id, competitor_id nullable, module_key (e.g. `swot`, `features`, `gaps`), payload jsonb, created_at

All with `authenticated` GRANTs + owner-scoped RLS using `report.user_id = auth.uid()`.

## Delivery phases

### Phase 1 — Foundation & Discovery (Modules 1, 2, 4)
- New page shell at `/intelligence` with tabbed layout (all 20 tabs stubbed, first 3 functional).
- Input bar: keyword | category | URL | Chrome ID.
- `ext-intel-discover`: Firecrawl `search` on `site:chromewebstore.google.com <query>`, return top 10/25/50 with metadata.
- `ext-intel-scrape`: Firecrawl `scrape` each listing (markdown + screenshot + links) → metadata extraction.
- Module 2 (Feature Extractor) + Module 4 (Listing Analyzer) run via `ext-intel-analyze` stages `features`, `listing`.
- Results persisted to `intel_reports/competitors/analyses`.

### Phase 2 — Deep Analysis (Modules 3, 5, 6, 7, 8, 11, 17)
- Screenshot Intelligence (Gemini vision on scraped image URLs).
- Review Intelligence — Firecrawl paginated scrape of reviews tab; Gemini clusters into categories.
- Sentiment AI, SWOT, Feature Gap Finder (cross-competitor diff), Security Intelligence, Competitive Scorecard.
- Each is a stage in `ext-intel-analyze` returning strict JSON, stored in `intel_analyses`.

### Phase 3 — Strategy & Blueprint (Modules 9, 10, 12, 13, 14, 15, 16, 18)
- Innovation Engine (30/50/100 ideas), Architecture Generator, Monetization, UX Redesign, RICE/MoSCoW/ICE prioritizer, Blueprint (PRD/roadmap/sprint), "Build Better Than This", Opportunity Heatmap (recharts scatter/heatmap).

### Phase 4 — Distribution (Modules 19, 20)
- AI Development Prompt Generator (Lovable / Cursor / Windsurf / Claude Code / Gemini CLI / Copilot / Bolt / Replit) — templated prompt built from the blueprint.
- Export Center: PDF (jspdf), Excel (xlsx), CSV, Markdown, JSON, Jira/ClickUp/Trello import formats. Existing `xlsxwriter`/pptx not applicable client-side — use `jspdf` + `xlsx` npm libs.

## UI structure (single page, 20 tabs grouped)

- **Discover**: Modules 1, 2
- **Analyze**: Modules 3, 4, 5, 6, 11, 17
- **Compete**: Modules 7, 8, 18
- **Build**: Modules 9, 10, 12, 13, 14, 15, 16
- **Ship**: Modules 19, 20

Left rail shows report history; main area shows the active competitor + module.

## Prerequisites (user actions)

1. **Link Firecrawl connector** — required for scraping. I'll prompt via `standard_connectors--connect` at Phase 1 start.
2. Lovable AI already available (`LOVABLE_API_KEY` present ✓).

## Technical notes

- Firecrawl calls go through Supabase edge functions (never expose `FIRECRAWL_API_KEY` client-side).
- Chrome Web Store aggressively rate-limits — cache scraped competitor data in DB, refresh only on demand.
- Long-running analyses (reviews mining, 100-idea innovation) run one module at a time from the UI to stay under edge-function timeouts; each returns strict JSON and streams results into the tab as they complete.
- Review scraping is limited to publicly visible pages; respect robots and Firecrawl ToS.
- Screenshot analysis uses `google/gemini-2.5-pro` (multimodal); text modules use `google/gemini-3-flash-preview` for cost.
- Existing `/intelligence` (codebase analysis via `software-intel`) moves to `/intelligence/codebase` as a sub-tab so nothing is lost.

## What I'll ship first if you approve

Phase 1 only:
- Firecrawl connector prompt
- Migration for `intel_*` tables
- `ext-intel-discover` + `ext-intel-scrape` + `ext-intel-analyze` edge functions
- Rewritten `/intelligence` page with tabbed shell, working Discover + Feature Extractor + Listing Analyzer tabs, and stubs for the remaining 17 tabs (each showing "coming in Phase N")

Then we iterate phase-by-phase based on what you see working.
