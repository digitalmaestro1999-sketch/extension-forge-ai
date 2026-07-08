# Extension Certification & CWS Readiness Engine

Build a scoring gate that runs before ZIP export, proving the generated extension is production-ready. Phased delivery; Phase 1 ships this turn.

## Phase 1 — Core validators + Readiness Dashboard (this turn)

New page `/certify` (linked from sidebar and from Package flow). Runs on the current extension in state and produces a scored report.

Modules implemented in `src/lib/certification/`:
1. **manifestValidator** — MV3 fields, icons (16/32/48/128), permissions sanity, action, background service_worker, CSP, web_accessible_resources, version format, update_url absent, default_locale.
2. **policyScanner** — regex + AST-light scan for: remote script URLs, `eval(`, `new Function(`, inline `on*=` handlers in HTML, `<script src="http…">`, obfuscation heuristics (avg identifier length, base64 blobs), tracking pixels, crypto miner strings, hidden iframes.
3. **syntaxValidator** — JSON.parse for manifest/locales, quick JS parse via `new Function` in a worker-safe try/catch (report throw msg), HTML/CSS balanced-tag/brace check.
4. **securityScanner** — `innerHTML=`, `document.write`, unsafe CSP directives, leaked keys (regex for `sk-`, `AIza`, `xox[baprs]-`, JWT-ish), `chrome.tabs.executeScript` w/ remote code.
5. **packagingValidator** — required files present (manifest, icons, at least one HTML if action.default_popup set), no `.DS_Store`/`node_modules`, ZIP flat structure.
6. **readinessScore** — weighted composite → `overall`, per-category %, PASS probability band (Low/Med/High), critical count, warning count.

UI: `src/pages/CertifyExtension.tsx`
- Category cards with % + status ring
- Overall Readiness gauge + PASS probability
- Issues table (severity, file, line-ish, message, fix hint)
- "Run AI Auto-Fix" button (calls Phase 2 loop — stub button now, wired in Phase 2)
- "Export Report (MD)" button
- Audit-logged: `preflight_pass` / `preflight_block` events

Integration: Package page's preflight gate calls the same `runCertification()` so scores match.

## Phase 2 — AI Auto-Fix loop + Runtime Simulator
- Edge function `certify-autofix` (Lovable AI, `openai/gpt-5.5`): given issues + offending file, returns rewritten file. Loop: fix → re-run validators → stop when score ≥ target or 3 iterations.
- Runtime Simulator: jsdom-in-browser mock of chrome.* APIs; boot popup + background, capture errors.
- Accessibility check (axe-core static rules on popup HTML).

## Phase 3 — Store Listing & Assets
- Store Listing Optimizer (title/desc/keywords/FAQ) via AI.
- Icon Generator (Gemini image) for 16/32/48/128 + 440×280 promo.
- Screenshot Generator (renders popup to canvas at 1280×800).
- Privacy Policy generator from permissions.

## Phase 4 — Competition Intelligence
- Firecrawl scraper of CWS category pages + individual listings.
- Extract: features, permissions, ratings, review sentiment (AI), update cadence.
- Gap analysis vs current extension; opportunities report.
- New tables: `intel_cws_listings`, `intel_gap_reports`.

## Technical notes
- All validators pure-TS, sync, no network — runnable both in `/certify` UI and inside Package preflight.
- Scoring weights: Manifest 20, Policy 20, Security 20, Syntax 15, Packaging 10, Perf/A11y 15 (Perf/A11y stub 100 until Phase 2).
- Audit events written via existing `security-audit-log.ts`.
- No DB migration required for Phase 1.

Phase 1 ships now; I'll ask before starting Phase 2.
