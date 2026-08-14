# UNIVERSAL AI API ORCHESTRATION STANDARD

**Version:** 1.0  
**Status:** Foundational / Mandatory  
**Scope:** All Lovable AI/SaaS/Web Applications  
**Primary Backend:** Supabase  
**Primary Runtime:** Supabase Edge Functions  
**Purpose:** Universal AI API discovery, selection, health monitoring, routing, fallback, observability and secure credential management.

---

# 1. CORE DIRECTIVE

Every AI-enabled application MUST implement a centralized AI API Orchestration Layer.

Individual modules MUST NOT directly call OpenAI, Anthropic, Gemini, NVIDIA NIM, OpenRouter, Blackbox, Z.ai, Qwen, DeepSeek, or any other AI provider.

Instead:

```text
Frontend Module
      ↓
AI Capability Request
      ↓
Universal AI Orchestrator
      ↓
Provider Registry
      ↓
Health Evaluation
      ↓
Priority Resolution
      ↓
Model Selection
      ↓
Provider API
      ↓
Response Validation
      ↓
Frontend
```

The AI Orchestrator is the single decision-making layer for all AI requests.

---

# 2. ABSOLUTE RULES

The following rules are mandatory.

## RULE 01 — NO DIRECT AI API CALLS FROM FRONTEND

The browser/frontend MUST NOT contain actual third-party AI API keys.

Forbidden:

```text
Frontend → OpenAI API
Frontend → Gemini API
Frontend → Anthropic API
Frontend → NVIDIA API
Frontend → Any provider directly
```

Required:

```text
Frontend
   ↓
Supabase Edge Function
   ↓
AI Orchestrator
   ↓
Provider API
```

---

## RULE 02 — ALL AI CREDENTIALS MUST BE SERVER-SIDE

Provider API keys MUST be stored and accessed only from secure server-side infrastructure.

Preferred:

```text
Supabase Vault
        +
Supabase Edge Function Secrets
        +
Server-side AI Orchestrator
```

Never expose:

```text
API keys
Bearer tokens
Provider secrets
Secret environment variables
Service-role credentials
```

to the browser.

Never place provider secrets in:

```text
React source
JavaScript
HTML
localStorage
sessionStorage
public database rows
GitHub
Git repository
client-side environment variables
browser network payloads
```

Supabase Edge Functions support server-side secrets, and Supabase recommends keeping secret keys out of browsers.

---

# 3. LOVABLE AI POLICY

Lovable-routed AI MUST NOT be automatically used as the application's AI provider.

Default:

```text
Lovable AI = OFF
```

Lovable AI may only be used when the user/admin explicitly enables it.

Configuration:

```text
lovable_ai_enabled = false
```

If enabled:

```text
lovable_ai_enabled = true
```

The application MUST visibly identify when Lovable AI is being used.

Example:

```text
Provider: Lovable AI
Model: <actual routed model>
Status: Active
```

No module may silently route to Lovable AI.

---

# 4. AI PROVIDER REGISTRY

Every application MUST maintain a centralized provider registry.

Example:

```text
Provider Registry

Provider X
Provider Y
Provider Z
Provider A
Provider B
```

Each provider record should contain:

```text
provider_id
provider_name
display_name
base_url
provider_type
enabled
priority
health_status
last_health_check
next_health_check
failure_count
success_count
latency_average
timeout_limit
supported_capabilities
discovery_method
authentication_method
rate_limit_information
cost_information
created_at
updated_at
```

The registry stores configuration metadata.

The actual API secret MUST remain protected.

---

# 5. AI MODEL REGISTRY

Every discovered or manually configured model MUST have a normalized model record.

Required fields:

```text
model_id
provider_id
model_name
model_display_name
model_api_identifier
capabilities
context_window
input_types
output_types
reasoning_support
vision_support
audio_support
image_generation
structured_output
tool_calling
streaming
enabled
priority
health_status
latency_average
failure_count
success_count
last_success
last_failure
last_health_check
cost_metadata
discovery_source
created_at
updated_at
```

The system MUST preserve the provider's actual model identifier.

Example:

```text
Provider:
NVIDIA NIM

Model:
actual-provider-model-id
```

Do not display generic labels such as:

```text
AI Model
Best Model
Smart AI
Default AI
```

when the actual provider/model is known.

---

# 6. CAPABILITY-FIRST ARCHITECTURE

AI requests MUST be expressed as capabilities rather than hardcoded providers.

Example:

```text
capability = text_generation
```

Other examples:

```text
reasoning
long_context
document_analysis
vision
image_generation
audio_transcription
audio_generation
translation
summarization
classification
structured_json
coding
research
embeddings
reranking
agentic_tool_use
```

A module should request:

```text
"Give me a reasoning-capable model"
```

rather than:

```text
"Use Provider X Model Y"
```

unless an administrator has explicitly locked the provider/model.

---

# 7. PROVIDER PRIORITY ALGORITHM

Each provider receives a configurable priority.

Example:

```text
Priority 1 → Provider Y
Priority 2 → Provider X
Priority 3 → Provider Z
```

The orchestrator MUST evaluate providers in priority order.

However:

> Priority alone MUST NOT override health, capability compatibility or model availability.

The effective selection order is:

```text
1. User/module configuration
2. Capability compatibility
3. Provider enabled status
4. Provider health
5. Provider priority
6. Model health
7. Model priority
8. Performance
9. Cost
10. Fallback
```

---

# 8. MODEL SELECTION ALGORITHM

Suppose:

```text
Provider Y
 ├── Model Y1
 ├── Model Y2
 ├── Model Y3
 ├── Model Y4
 └── Model Y5

Provider X
 ├── Model X1
 ├── Model X2
 ├── Model X3
 └── Model X4

Provider Z
 ├── Model Z1
 └── Model Z2
```

Provider priority:

```text
Y = 1
X = 2
Z = 3
```

The orchestrator MUST attempt:

```text
Y1
 ↓ failure
Y2
 ↓ failure
Y3
 ↓ failure
Y4
 ↓ failure
Y5
 ↓ all failed
X1
 ↓ failure
X2
 ↓ failure
X3
 ↓ failure
X4
 ↓ all failed
Z1
 ↓ failure
Z2
```

The orchestrator MUST NOT immediately jump to Provider X when another eligible model in Provider Y is still available.

---

# 9. EFFECTIVE PRIORITY SCORE

The orchestrator should calculate an effective score.

Conceptually:

```text
Effective Score =
Capability Match
+
Provider Priority
+
Model Priority
+
Health Score
+
Recent Success Rate
+
Latency Score
+
Availability
+
Cost Score
```

Example:

```text
Capability Match       30%
Health                 20%
Provider Priority      15%
Model Priority         10%
Success Rate           10%
Latency                5%
Availability            5%
Cost                    5%
```

These weights MUST remain configurable.

Different applications may change weights without changing the orchestration architecture.

---

# 10. HEALTH MANAGEMENT

Every provider and model MUST have health monitoring.

Minimum health states:

```text
UNKNOWN
HEALTHY
DEGRADED
UNHEALTHY
RATE_LIMITED
AUTH_FAILED
TIMEOUT
DISABLED
```

Health information should include:

```text
health_status
health_score
last_check
last_success
last_failure
failure_count
consecutive_failures
average_latency
timeout_count
rate_limit_count
authentication_failure_count
```

---

# 11. AUTOMATIC HEALTH REFRESH

Health checking MUST be enabled by default.

The backend should periodically evaluate:

```text
Provider availability
Authentication
API endpoint response
Model availability
Latency
Timeouts
HTTP status
Rate limits
Malformed responses
Provider errors
```

Recommended architecture:

```text
Supabase pg_cron
      ↓
Health Monitor Edge Function
      ↓
Provider Registry
      ↓
Provider Health Checks
      ↓
Model Health Checks
      ↓
Health Scores
```

Supabase supports scheduled Edge Function invocation using `pg_cron` and `pg_net`.

---

# 12. ADAPTIVE HEALTH

Health MUST NOT be based only on periodic checks.

Real production requests must also update health.

Example:

```text
Successful request
→ health score increases

Timeout
→ health score decreases

5xx error
→ health score decreases

Authentication error
→ provider temporarily quarantined

Rate limit
→ provider/model temporarily deprioritized

Successful recovery
→ health score restored
```

The system should use both:

```text
Proactive Health Checks
+
Passive Production Telemetry
```

---

# 13. CIRCUIT BREAKER

Each provider/model should have a circuit breaker.

Example:

```text
HEALTHY
   ↓ repeated failures
DEGRADED
   ↓ threshold exceeded
OPEN / QUARANTINED
   ↓ recovery test
HALF_OPEN
   ↓ successful
HEALTHY
```

A provider in OPEN state should not receive normal traffic.

A recovery probe can test it periodically.

---

# 14. AUTOMATIC FALLBACK

Fallback is mandatory.

If the selected model fails:

```text
Try next eligible model
```

If all eligible models fail:

```text
Try next eligible provider
```

If all providers fail:

```text
Return controlled AI service failure
```

Never silently fabricate an AI response.

Example:

```text
AI_SERVICE_UNAVAILABLE
```

with useful diagnostic metadata.

---

# 15. FAILURE CLASSIFICATION

Failures must be classified.

Examples:

```text
AUTH_ERROR
INVALID_API_KEY
MODEL_NOT_FOUND
ENDPOINT_NOT_FOUND
RATE_LIMIT
TIMEOUT
NETWORK_ERROR
SERVER_ERROR
INVALID_RESPONSE
CONTENT_FILTER
CONTEXT_LIMIT
QUOTA_EXCEEDED
CAPABILITY_UNSUPPORTED
PROVIDER_DISABLED
MODEL_DISABLED
```

Not every error should trigger the same fallback behavior.

Example:

```text
MODEL_NOT_FOUND
→ skip model

RATE_LIMIT
→ temporarily deprioritize model/provider

AUTH_ERROR
→ quarantine provider

TIMEOUT
→ try next model

CAPABILITY_UNSUPPORTED
→ immediately select compatible model
```

---

# 16. API MODEL DISCOVERY

Every provider SHOULD support automatic model discovery.

When an administrator enters:

```text
Provider Name
Base URL
Authentication configuration
```

the system should attempt:

```text
DISCOVER PROVIDER
      ↓
DETECT API TYPE
      ↓
DETECT DISCOVERY ENDPOINT
      ↓
FETCH AVAILABLE MODELS
      ↓
NORMALIZE MODELS
      ↓
STORE MODEL METADATA
      ↓
DISPLAY MODELS
```

---

# 17. BASE URL DISCOVERY

The application must provide:

```text
Base URL
```

as the primary provider configuration field.

Example:

```text
https://provider.example.com/v1
```

The system should attempt known discovery mechanisms.

Examples:

```text
GET /models
GET /v1/models
GET /models/list
Provider-specific discovery endpoint
Provider-specific metadata endpoint
```

However:

> The system MUST NOT assume that every provider exposes a model-list endpoint.

If automatic discovery is unsupported, the provider adapter must report:

```text
DISCOVERY_UNSUPPORTED
```

and allow:

```text
Manual Model Registration
```

---

# 18. PROVIDER ADAPTER ARCHITECTURE

Each provider should use an adapter.

Conceptually:

```text
AIProviderAdapter
```

Interface:

```text
discoverModels()
healthCheck()
execute()
stream()
validateResponse()
normalizeError()
getCapabilities()
```

Example:

```text
OpenAIAdapter
GeminiAdapter
AnthropicAdapter
NvidiaNimAdapter
OpenRouterAdapter
BlackboxAdapter
ZAIAdapter
CustomRESTAdapter
```

The orchestrator should interact with adapters rather than provider-specific code.

---

# 19. UNIVERSAL REST ADAPTER

A generic adapter MUST be supported.

Configuration:

```text
base_url
models_endpoint
chat_endpoint
headers
authentication_header
request_template
response_path
streaming_configuration
health_endpoint
```

This allows unknown providers to be integrated without rebuilding the orchestrator.

---

# 20. MODEL NORMALIZATION

Different providers use different model schemas.

The system must normalize them into one internal format.

Provider response:

```text
id
name
owned_by
context_length
...
```

must become:

```text
model_id
provider_id
model_name
capabilities
context_window
status
```

The original provider metadata should also be preserved.

---

# 21. USER OVERRIDE

The system must support user/admin selection.

Possible modes:

```text
AUTO
PROVIDER_LOCK
MODEL_LOCK
PROVIDER_PREFERENCE
MODEL_PREFERENCE
```

Default:

```text
AUTO
```

Example:

```text
Preferred Provider:
Provider Y

Preferred Model:
AUTO
```

The orchestrator then chooses the best healthy model inside Provider Y.

---

# 22. MODULE-LEVEL AI CONFIGURATION

Each application module may define its AI requirement.

Example:

```text
Module:
DPR Generator

Capability:
long_context + reasoning + structured_output
```

Another:

```text
Module:
Image Generator

Capability:
image_generation
```

Another:

```text
Module:
Document OCR

Capability:
vision + document_analysis
```

The module MUST NOT contain API keys.

The module only declares:

```text
required_capabilities
preferred_provider
preferred_model
fallback_policy
temperature
token_limit
response_format
```

---

# 23. AI REQUEST CONTRACT

Every AI request should use a normalized internal request.

Example:

```json
{
  "module": "dpr_generator",
  "capability": ["reasoning", "long_context", "structured_output"],
  "mode": "auto",
  "preferred_provider": null,
  "preferred_model": null,
  "fallback_enabled": true,
  "stream": false
}
```

The orchestrator resolves the actual provider/model.

---

# 24. AI RESPONSE CONTRACT

Every response must return standardized metadata.

Minimum:

```text
request_id
provider_id
provider_name
model_id
model_name
success
latency_ms
fallback_used
attempt_number
attempt_count
health_status
```

Example:

```json
{
  "success": true,
  "provider": "Provider Y",
  "model": "actual-model-id",
  "latency_ms": 1830,
  "fallback_used": false,
  "attempt_number": 1
}
```

---

# 25. FRONTEND AI TRANSPARENCY

The frontend MUST expose the actual provider and model being used.

This is a mandatory beta-testing/observability feature.

Recommended display:

```text
AI Provider: Provider Y
Model: actual-model-id
Status: Healthy
Latency: 1.83s
Fallback: No
```

When fallback occurs:

```text
AI Provider: Provider X
Model: actual-model-id

Fallback:
Yes

Original:
Provider Y / Model Y1

Reason:
Timeout
```

---

# 26. BETA TESTING MODE

Every application should support:

```text
AI DEBUG / BETA MODE
```

When enabled, display:

```text
Provider
Model
Request ID
Latency
Fallback
Attempt
Health
Error classification
Token usage if available
Estimated cost if available
```

Sensitive information MUST NEVER be displayed.

Never display:

```text
API keys
Authorization headers
Secrets
Raw credentials
```

---

# 27. AI EXECUTION LOG

Every AI request should generate an execution record.

Example:

```text
ai_execution_logs

request_id
user_id
module_id
provider_id
model_id
capability
attempt_number
success
latency_ms
fallback_used
failure_type
token_input
token_output
estimated_cost
created_at
```

Prompt content should only be stored when explicitly permitted by the application's privacy policy.

---

# 28. NO SECRET LOGGING

Never log:

```text
API keys
Bearer tokens
Authorization headers
secret environment variables
provider credentials
```

Do not accidentally expose credentials in:

```text
console.log
Edge Function logs
database logs
error tracking
analytics
frontend telemetry
```

---

# 29. DATABASE FOUNDATION

Recommended logical tables:

```text
ai_providers
ai_provider_credentials
ai_models
ai_capabilities
ai_provider_capabilities
ai_model_capabilities
ai_module_ai_config
ai_health_status
ai_health_checks
ai_execution_logs
ai_fallback_events
ai_discovery_runs
ai_provider_settings
ai_system_settings
```

Credentials should be represented by secure references rather than exposed plaintext values.

Example:

```text
credential_ref
```

instead of:

```text
api_key
```

---

# 30. SECURITY MODEL

Frontend:

```text
Supabase Publishable Key
+
Authenticated User Session
```

Backend:

```text
Supabase Edge Functions
+
Secure Secrets
+
RLS
+
Authorization
```

Provider:

```text
Provider API Key
```

The provider API key must remain server-side.

Supabase recommends using Edge Functions for server-side logic involving secrets and external APIs.

---

# 31. RLS

All user-specific configuration must be protected using Row Level Security.

Users should only access:

```text
their own AI preferences
their own execution history
their own module configuration
```

Administrative records should require:

```text
admin
superadmin
```

authorization.

---

# 32. PROVIDER MANAGEMENT UI

Every application using this standard should have an AI Provider Control Center.

Minimum sections:

```text
Providers
Models
Capabilities
Priority
Health
Discovery
Credentials
Routing
Fallback
Usage
Logs
```

---

# 33. PROVIDER CARD

Each provider should show:

```text
Provider Name
Enabled / Disabled
Priority
Health
Last Check
Models Available
Models Enabled
Success Rate
Average Latency
Failures
```

Example:

```text
Provider Y

Priority: #1
Status: HEALTHY
Models: 5
Enabled Models: 5
Success Rate: 98.7%
Latency: 1.8s
Last Check: 2 min ago
```

---

# 34. MODEL CARD

Each model should show:

```text
Provider
Actual Model ID
Capabilities
Enabled
Priority
Health
Success Rate
Latency
Failures
Last Used
```

---

# 35. DISCOVERY UI

Provider setup should contain:

```text
Provider Name
Base URL
Authentication
Discovery
```

Button:

```text
DISCOVER MODELS
```

Result:

```text
Models Found: 17

✓ Model A
✓ Model B
✓ Model C
...
```

Administrator can then:

```text
Enable
Disable
Prioritize
Test
Assign Capabilities
```

---

# 36. DISCOVERY SAFETY

Model discovery MUST NOT automatically enable every discovered model.

Discovery:

```text
DISCOVER
   ↓
REVIEW
   ↓
ENABLE
   ↓
PRIORITIZE
```

Newly discovered models should default to:

```text
enabled = false
```

unless explicitly configured otherwise.

---

# 37. PROVIDER TEST

Every provider should support:

```text
TEST CONNECTION
```

The test should verify:

```text
DNS/network
authentication
endpoint
model availability
basic inference
response validity
latency
```

Result:

```text
PASS
FAIL
DEGRADED
```

---

# 38. MODEL TEST

Every enabled model should support:

```text
TEST MODEL
```

The test should verify the model can perform its declared capability.

Example:

```text
Reasoning test
JSON test
Vision test
Long-context test
Image test
```

---

# 39. CAPABILITY VALIDATION

Never assume a model supports a capability only because the provider says so.

Use:

```text
Provider Metadata
+
Model Metadata
+
Observed Test Results
```

to determine effective capability.

---

# 40. PROVIDER + MODEL SELECTION MATRIX

The orchestrator should maintain:

```text
Capability
    ↓
Eligible Providers
    ↓
Healthy Providers
    ↓
Priority
    ↓
Eligible Models
    ↓
Healthy Models
    ↓
Performance
    ↓
Selected Model
```

---

# 41. FALLBACK MATRIX

Example:

```text
Primary Provider
    ↓
Primary Model
    ↓
Secondary Model
    ↓
Tertiary Model
    ↓
Secondary Provider
    ↓
Secondary Provider Model
    ↓
Tertiary Provider
```

Fallback must be deterministic and observable.

---

# 42. ANTI-STICKINESS RULE

The system must not permanently stick to a provider/model simply because it was successful once.

The routing engine should continuously evaluate:

```text
health
latency
success rate
availability
priority
cost
capability
```

---

# 43. TEMPORARY QUARANTINE

If a provider/model repeatedly fails:

```text
quarantine = true
```

for a configurable period.

Example:

```text
5 consecutive failures
→ 5-minute quarantine
```

After quarantine:

```text
recovery test
```

If successful:

```text
return to pool
```

---

# 44. RATE LIMIT MANAGEMENT

Rate limits should be tracked independently.

Example:

```text
Provider Y
Rate Limit:
429

Action:
Temporarily reduce priority
```

Do not permanently disable the provider for a temporary rate-limit event.

---

# 45. COST-AWARE ROUTING

Cost may be included in routing but MUST NOT override explicit user/admin model locks.

Example:

```text
Premium Mode:
Quality > Cost

Balanced Mode:
Quality + Cost

Economy Mode:
Cost > Quality
```

---

# 46. PERFORMANCE LEARNING

The system should continuously learn from execution history.

Metrics:

```text
success rate
failure rate
latency
timeout rate
fallback frequency
cost
capability success
```

This creates an evidence-based routing system.

---

# 47. ROUTING MODES

Support:

```text
AUTO
QUALITY
BALANCED
ECONOMY
FASTEST
USER_SELECTED
PROVIDER_LOCKED
MODEL_LOCKED
```

Default:

```text
AUTO
```

---

# 48. GLOBAL VS MODULE SETTINGS

The application must support:

```text
Global AI Settings
        ↓
Provider Settings
        ↓
Module AI Settings
        ↓
User Preferences
        ↓
Request-Level Override
```

Highest valid explicit override wins.

---

# 49. NO HARDCODED PROVIDER LOGIC IN MODULES

Forbidden:

```text
if module === "dpr":
   call Gemini()
```

Required:

```text
AIOrchestrator.execute({
   capability: "reasoning"
})
```

The module must remain provider-independent.

---

# 50. STANDARD EDGE FUNCTIONS

A recommended implementation includes:

```text
ai-orchestrator
ai-provider-discovery
ai-provider-health
ai-model-health
ai-provider-test
ai-model-test
ai-execution
ai-routing
ai-admin
```

These may be combined where appropriate, but the responsibilities must remain logically separated.

---

# 51. CRON / BACKGROUND HEALTH PROCESS

Default background process:

```text
Scheduler
   ↓
Provider Health Check
   ↓
Model Health Check
   ↓
Update Health Scores
   ↓
Update Routing Eligibility
   ↓
Clear Recoveries
   ↓
Record Metrics
```

The process should run automatically without requiring frontend activity.

---

# 52. HEALTH CHECK FREQUENCY

Health-check frequency should be configurable.

Example:

```text
Critical provider:
1–5 minutes

Normal provider:
5–15 minutes

Inactive provider:
30–60 minutes
```

The system should avoid unnecessary provider API consumption.

---

# 53. DISCOVERY REFRESH

Model discovery should also be refreshable.

Example:

```text
Manual Refresh
+
Scheduled Refresh
+
On-demand Refresh
```

New models should enter:

```text
DISCOVERED
```

state before being activated.

---

# 54. API PROVIDER LIFECYCLE

Every provider follows:

```text
CREATED
 ↓
DISCOVERING
 ↓
DISCOVERED
 ↓
CONFIGURED
 ↓
TESTING
 ↓
ACTIVE
 ↓
DEGRADED
 ↓
QUARANTINED
 ↓
RECOVERING
 ↓
ACTIVE
```

---

# 55. MODEL LIFECYCLE

Every model follows:

```text
DISCOVERED
 ↓
REVIEW
 ↓
ENABLED
 ↓
HEALTHY
 ↓
DEGRADED
 ↓
FAILED
 ↓
RECOVERY
 ↓
HEALTHY
```

---

# 56. AUDIT LOG

Administrative changes must be auditable.

Track:

```text
provider added
provider removed
provider enabled
provider disabled
priority changed
model enabled
model disabled
model priority changed
credential updated
routing changed
Lovable AI enabled
Lovable AI disabled
```

---

# 57. AI REQUEST ID

Every AI request MUST have a unique:

```text
request_id
```

This ID must connect:

```text
Frontend request
→ orchestrator
→ provider attempt
→ fallback
→ response
→ execution log
```

This is essential for debugging.

---

# 58. OBSERVABILITY

The system should make it possible to answer:

```text
Which provider answered?
Which model answered?
Why was it selected?
Which models were skipped?
Did fallback occur?
Why did fallback occur?
How long did it take?
Was the provider healthy?
How often does the provider fail?
```

---

# 59. FRONTEND STATUS DISPLAY

AI-powered components should optionally display:

```text
● Provider Y
Model: Y5
1.9s
```

or:

```text
AI: Provider Y / Y5
Fallback: X / X2
```

This transparency is particularly important during beta testing.

---

# 60. USER-FACING VS ADMIN-FACING DETAILS

Normal users may see:

```text
Provider
Model
Status
Latency
Fallback
```

Administrators may additionally see:

```text
error classification
health score
failure counts
routing score
cost
rate limits
provider diagnostics
```

Secrets remain invisible to both.

---

# 61. PRIVACY

Do not expose sensitive prompts, documents or user data unnecessarily in logs.

Use:

```text
metadata-first logging
```

Store only the minimum information necessary for:

```text
debugging
billing
analytics
routing
quality monitoring
```

---

# 62. STREAMING

The orchestration layer should support both:

```text
non-streaming
streaming
```

The frontend should not care which provider implements the stream.

Normalize streaming behavior behind the orchestrator.

---

# 63. STRUCTURED OUTPUT

Where supported, the orchestrator should normalize:

```text
JSON
schema-based output
tool calls
function calls
structured responses
```

If a model does not support the requested format:

```text
skip model
```

and select the next compatible model.

---

# 64. CONTEXT LIMIT

Before execution, validate:

```text
input size
context window
requested output size
```

If the selected model cannot support the request:

```text
do not call it
```

Select another eligible model.

---

# 65. CAPABILITY MISMATCH

Never waste an API request on an incompatible model.

Example:

```text
Required:
vision

Model:
text-only

Action:
SKIP
```

---

# 66. PROVIDER-LEVEL VS MODEL-LEVEL HEALTH

These are separate.

Example:

```text
Provider Y:
HEALTHY

Model Y1:
UNHEALTHY

Model Y2:
HEALTHY
```

The orchestrator should still use:

```text
Provider Y → Model Y2
```

without unnecessarily abandoning the provider.

---

# 67. PROVIDER FAILURE

Example:

```text
Provider Y:
UNHEALTHY

Models:
Y1
Y2
Y3
Y4
Y5
```

The orchestrator should move to:

```text
Provider X
```

only after determining that Provider Y cannot currently serve the request.

---

# 68. MODEL FAILURE

Example:

```text
Provider Y = healthy

Y1 = timeout
Y2 = healthy
Y3 = healthy
```

Use:

```text
Y2
```

not Provider X.

---

# 69. EXECUTION ALGORITHM

Universal execution sequence:

```text
START
 ↓
Authenticate User
 ↓
Validate Module
 ↓
Validate Capability
 ↓
Read AI Configuration
 ↓
Check Lovable AI Policy
 ↓
Build Eligible Provider Pool
 ↓
Remove Disabled Providers
 ↓
Remove Unhealthy Providers
 ↓
Sort Providers by Effective Priority
 ↓
Select Highest Priority Provider
 ↓
Build Eligible Model Pool
 ↓
Remove Disabled Models
 ↓
Remove Capability-Incompatible Models
 ↓
Remove Unhealthy Models
 ↓
Sort Models by Effective Score
 ↓
Execute Best Model
 ↓
Validate Response
 ↓
SUCCESS?
 ├── YES → Record Telemetry → Return
 └── NO
       ↓
Classify Error
       ↓
Retry Eligible Model?
       ├── YES → Next Model
       └── NO
             ↓
Next Provider
       ↓
Repeat
       ↓
All Exhausted?
 ├── NO → Execute
 └── YES → Controlled Failure
```

---

# 70. RETRY POLICY

Retries must be bounded.

Never create:

```text
infinite retry loops
```

Use configurable limits:

```text
max_model_attempts
max_provider_attempts
max_total_attempts
```

---

# 71. IDEMPOTENCY

Requests that could create side effects should support:

```text
idempotency_key
```

This prevents accidental duplicate execution during retries.

---

# 72. PROVIDER LOCK

If an administrator explicitly locks:

```text
Provider Y
```

the system should remain inside Provider Y unless:

```text
fallback policy permits provider switching
```

Example:

```text
Provider Lock:
Y

Fallback:
Same Provider Only
```

or:

```text
Provider Lock:
Y

Fallback:
Any Healthy Provider
```

---

# 73. MODEL LOCK

If the administrator explicitly selects:

```text
Provider Y / Model Y3
```

the system should use that model unless:

```text
fallback_enabled = true
```

Then the fallback policy determines the next model.

---

# 74. FALLBACK POLICIES

Support:

```text
NONE
SAME_MODEL_ONLY
SAME_PROVIDER
NEXT_PROVIDER
GLOBAL
```

Default:

```text
GLOBAL
```

for production reliability unless the module requires strict model consistency.

---

# 75. EXPERIMENT / A-B TESTING

The architecture should support future:

```text
A/B testing
model comparison
provider comparison
benchmarking
```

Example:

```text
Provider Y / Model Y1
vs
Provider X / Model X2
```

Record:

```text
quality
latency
cost
success
user feedback
```

---

# 76. QUALITY FEEDBACK

Where practical, allow users/admins to record:

```text
Good
Bad
Regenerate
Incorrect
Excellent
```

Associate feedback with:

```text
provider
model
module
request_id
```

This allows real-world model evaluation.

---

# 77. UNIVERSAL AI CONTROL CENTER

Every major application should eventually expose:

```text
AI Control Center
```

Sections:

```text
Overview
Providers
Models
Capabilities
Routing
Health
Discovery
Testing
Usage
Costs
Logs
Experiments
Settings
```

---

# 78. DASHBOARD SUMMARY

Example:

```text
AI PROVIDERS

3 Active
1 Degraded
0 Unhealthy

MODELS

14 Enabled
3 Degraded
1 Quarantined

TODAY

Requests: 12,430
Success: 98.8%
Fallback: 3.1%
Average Latency: 1.74s
```

---

# 79. PROVIDER PRIORITY EXAMPLE

```text
#1 Provider Y
   Y1
   Y2
   Y3
   Y4
   Y5

#2 Provider X
   X1
   X2
   X3
   X4

#3 Provider Z
   Z1
   Z2
```

The orchestrator must respect this hierarchy unless health/capability/routing policies override it.

---

# 80. IMPORTANT DISTINCTION

The system must distinguish:

```text
AVAILABLE
```

from:

```text
HEALTHY
```

and:

```text
HEALTHY
```

from:

```text
BEST FOR THIS REQUEST
```

Example:

```text
Model A:
Available = YES
Healthy = YES
Capability Match = NO

Model B:
Available = YES
Healthy = YES
Capability Match = YES

Model B wins.
```

---

# 81. DISCOVERY DOES NOT EQUAL ACTIVATION

A discovered model is not automatically production-ready.

Required:

```text
DISCOVER
→ NORMALIZE
→ TEST
→ REVIEW
→ ENABLE
→ PRIORITIZE
```

---

# 82. SECRET MIGRATION

If an application currently contains provider keys in frontend code:

```text
DETECT
 ↓
IDENTIFY
 ↓
MIGRATE
 ↓
STORE SECURELY
 ↓
REPLACE FRONTEND REFERENCE
 ↓
VERIFY BACKEND EXECUTION
 ↓
REMOVE FRONTEND SECRET
```

The migration must be verified before removing the old integration.

---

# 83. SECRET EXPOSURE CHECK

During development and deployment, scan for:

```text
sk-
AIza
Bearer
API_KEY
SECRET
TOKEN
PRIVATE_KEY
```

and provider-specific credential patterns.

False positives must be reviewed.

---

# 84. NO SECRET RETURN CONTRACT

Edge Functions MUST never return provider credentials to the client.

Forbidden:

```json
{
  "api_key": "..."
}
```

Required:

```json
{
  "provider": "Provider Y",
  "model": "Y3"
}
```

---

# 85. ERROR RESPONSE CONTRACT

Frontend receives:

```json
{
  "success": false,
  "request_id": "uuid",
  "error_code": "AI_SERVICE_UNAVAILABLE",
  "message": "No healthy compatible AI model is currently available."
}
```

Never expose internal secrets or unnecessary provider internals.

---

# 86. ADMIN DIAGNOSTICS

Administrators should be able to inspect:

```text
Provider
Model
Attempt sequence
Failure reason
Fallback sequence
Latency
Health
```

Example:

```text
Request: abc123

Attempt 1
Provider Y / Y1
TIMEOUT

Attempt 2
Provider Y / Y2
AUTH_ERROR

Attempt 3
Provider Y / Y3
SUCCESS

Final:
Provider Y / Y3
```

---

# 87. UNIVERSAL CONFIGURATION OBJECT

Every application should maintain a centralized AI configuration equivalent to:

```text
ai_orchestration_config

lovable_ai_enabled
default_routing_mode
fallback_enabled
health_monitoring_enabled
discovery_enabled
beta_transparency_enabled
max_attempts
provider_switch_allowed
model_switch_allowed
cost_optimization_enabled
logging_enabled
```

---

# 88. DEFAULT CONFIGURATION

Recommended defaults:

```text
lovable_ai_enabled = false

routing_mode = AUTO

fallback_enabled = true

health_monitoring_enabled = true

discovery_enabled = true

beta_transparency_enabled = true

provider_switch_allowed = true

model_switch_allowed = true

logging_enabled = true
```

---

# 89. NON-NEGOTIABLE ARCHITECTURAL PRINCIPLE

No application module should ever need to know:

```text
where the API key lives
how authentication works
which provider endpoint is used
how provider fallback works
how provider health is calculated
how model discovery works
```

The module only needs to know:

```text
"I need capability X."
```

The Universal AI Orchestrator handles the rest.

---

# 90. LOVABLE IMPLEMENTATION DIRECTIVE

When this file is added to a Lovable project, Lovable MUST treat this document as a foundational architecture constraint.

When creating or modifying any AI-enabled feature:

```text
READ THIS STANDARD FIRST
```

Then:

```text
DO NOT CREATE DIRECT PROVIDER CALLS
DO NOT CREATE FRONTEND API KEYS
DO NOT BYPASS AI ORCHESTRATOR
DO NOT ENABLE LOVABLE AI BY DEFAULT
DO NOT HARDCODE A SINGLE PROVIDER
DO NOT REMOVE FALLBACK
DO NOT REMOVE HEALTH MONITORING
DO NOT REMOVE MODEL DISCOVERY
DO NOT REMOVE PROVIDER/MODEL TRANSPARENCY
```

---

# 91. IMPLEMENTATION ORDER

When implementing this standard in a new application, follow:

```text
1. Supabase connection
2. Authentication
3. Database schema
4. Secure secret architecture
5. Provider registry
6. Model registry
7. Capability registry
8. Provider adapters
9. Model discovery
10. Health monitoring
11. Routing engine
12. Fallback engine
13. AI execution Edge Function
14. Execution logging
15. Admin AI Control Center
16. Frontend provider/model transparency
17. Testing
18. Failure simulation
19. Security audit
20. Production activation
```

---

# 92. ACCEPTANCE TESTS

The implementation is incomplete unless all tests pass.

## Security

```text
[ ] No provider API key exists in frontend source
[ ] No provider API key exists in browser storage
[ ] No provider secret is returned to frontend
[ ] Secrets are server-side
[ ] RLS is enabled
[ ] Admin access is protected
```

## Provider

```text
[ ] Provider can be added
[ ] Provider can be enabled/disabled
[ ] Provider priority works
[ ] Provider health works
[ ] Provider test works
```

## Discovery

```text
[ ] Base URL can be configured
[ ] Automatic model discovery works where supported
[ ] Unsupported discovery is handled gracefully
[ ] Models can be manually added
[ ] Discovered models are not automatically activated
```

## Models

```text
[ ] Models can be enabled/disabled
[ ] Model priority works
[ ] Model health works
[ ] Capability matching works
```

## Routing

```text
[ ] Highest-priority healthy provider is selected
[ ] Best eligible model is selected
[ ] Failed model triggers next model
[ ] Exhausted provider triggers next provider
[ ] All-provider failure is handled gracefully
```

## Transparency

```text
[ ] Actual provider is displayed
[ ] Actual model is displayed
[ ] Latency can be displayed
[ ] Fallback can be displayed
[ ] Request ID is available
```

## Lovable AI

```text
[ ] Lovable AI is OFF by default
[ ] Lovable AI cannot activate silently
[ ] Explicit user/admin enablement is required
[ ] Lovable AI usage is visible
```

## Health

```text
[ ] Automatic health refresh works
[ ] Failed providers are deprioritized
[ ] Failed models are deprioritized
[ ] Circuit breaker works
[ ] Recovery checks work
```

---

# 93. FINAL UNIVERSAL RULE

For every AI feature added to any application:

```text
MODULE
   ↓
CAPABILITY
   ↓
UNIVERSAL AI ORCHESTRATOR
   ↓
HEALTHY PROVIDER
   ↓
BEST ELIGIBLE MODEL
   ↓
EXECUTION
   ↓
VALIDATION
   ↓
TELEMETRY
   ↓
RESPONSE
```

Never:

```text
MODULE
   ↓
HARDCODED PROVIDER
   ↓
API KEY
   ↓
DIRECT API CALL
```

The Universal AI Orchestrator is the only approved gateway to external AI providers.

**This standard takes precedence over individual module-level AI integration patterns unless an explicit application-level architecture decision overrides it.**