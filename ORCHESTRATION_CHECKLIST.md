# Implementation Checklist: UNIVERSAL AI API ORCHESTRATION STANDARD

## 1. CORE DIRECTIVE
- [x] **Centralized AI API Orchestrator**: Implemented via `ai-chat` Edge Function.
- [x] **Single Decision Layer**: All requests pass through the logic that evaluates health, favorites, and fallbacks.

## 2. ABSOLUTE RULES
- [x] **RULE 01: No Direct AI API Calls from Frontend**: All AI interactions now route through Supabase Edge Functions.
- [x] **RULE 02: All AI Credentials Server-Side**: Keys are encrypted with AES-GCM and stored in the database; decryption only occurs within the secure Edge Function environment.
- [x] **No Exposure**: Plaintext keys are blocked from retrieval via the `user-api-keys` reveal action.

## 3. LOVABLE AI POLICY
- [x] **Default Toggle**: `use_lovable_ai` boolean added to user profiles.
- [x] **Explicit Enablement**: API Manager includes a global switch to toggle Lovable AI.
- [x] **Visible Identification**: UI badges ("Lovable AI Routed") added to all integrated modules.

## 4. AI PROVIDER REGISTRY
- [x] **Metadata Storage**: `user_api_keys` table stores `service`, `label`, `base_url`, and `model_id`.
- [x] **Health Tracking**: Backend tracks `status` and `last_check` for each provider.

## 5. AI MODEL REGISTRY
- [x] **Normalization**: `ai_model_registry` table created for unified capability indexing.
- [x] **Model Identifiers**: System preserves and uses the specific `model_id` provided by the API source.

## 6. CAPABILITY-FIRST ARCHITECTURE
- [ ] **Capability Mapping**: Currently, most modules request specific actions. 
- [ ] *Recommendation*: Implement a `capability` field in the request payload to allow the orchestrator to pick the best model for "reasoning", "vision", or "coding" tasks automatically.

## 7-9. PRIORITY & SELECTION ALGORITHMS
- [x] **Failover Logic**: Sequentially attempts: 1. Manually Selected Provider -> 2. Saved Favorites -> 3. Any Other Healthy User Key -> 4. Lovable AI (if enabled).
- [x] **Redundancy**: The orchestrator cycles through all eligible candidates until one succeeds.

## 10-11. HEALTH MANAGEMENT
- [x] **Preflight Checks**: `ai-chat` verifies connectivity to the provider's `/models` endpoint before routing.
- [x] **Background Refresh**: `ApiManager.tsx` runs periodic health checks every 60 seconds.
- [x] **Timeout Protection**: 5-second cap on health check requests to prevent latency spikes.

## OBSERVED GAPS & NEXT STEPS
1. **Migrate Remaining Modules**: [IN PROGRESS] `discover-trends` now uses the central orchestrator. Other utility functions are being refactored.
2. **Normalized Model Table**: [DONE] `ai_model_registry` table implemented with RLS.
3. **Structured Logging**: [DONE] `security_audit_logs` updated to capture latency and model metadata.
