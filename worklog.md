# Work Log — Sit With Me Project

---
Task ID: session-2026-06-08
Agent: Main Agent
Task: Fix Google OAuth, AI SDK, and deploy to HF Spaces

## Work Log:
- Diagnosed Google OAuth `error=google` on HF Spaces — NextAuth v4 is incompatible with Next.js 16
- Built custom Google OAuth flow at `/api/auth/google/signin` and `/api/auth/google/callback`
- Fixed Docker redirect bug (0.0.0.0:7860 → NEXTAUTH_URL) in callback route
- Found AI not working: GEMINI_API_KEY (24 chars, INVALID) was being used instead of GEMINI_KEY (39 chars, VALID)
- Ran comprehensive thinker agent audit — found 6 issues:
  1. Debug endpoint had inverted key priority
  2. All routes used hardcoded `gemini-2.0-flash` instead of model constants
  3. ai-sdk.ts logging showed wrong key source
  4. No MODELS constants — strings scattered across 11 files
  5. ZAI fallback logic could fall back to invalid GEMINI_API_KEY
  6. key-test route accepted but ignored apiKey parameter
- Fixed ALL 6 issues:
  - Added `MODELS = { FAST: 'gemini-2.0-flash-lite', SMART: 'gemini-2.0-flash' }` constants
  - SMART model for: onboard, chat, plan, path (conversation/reasoning)
  - FAST model for: challenge, resources, summary, flashcard, key-test (simple JSON)
  - Key priority: GEMINI_KEY > GEMINI_API_KEY
  - Lazy import z-ai-web-dev-sdk to prevent crashes on HF Spaces
  - Fixed debug endpoint to match key priority
- Cleaned git history (removed tectonic binary and logo.png blocking HF push)
- Pushed all fixes to GitHub and HF Spaces

## Stage Summary:
- Google OAuth: Custom flow works (signs in, creates user), but user must add redirect URI `https://kira-shin-sit-with-me.hf.space/api/auth/google/callback` in Google Cloud Console
- Guest signup: Works perfectly on HF Spaces
- AI: Code is correct (GEMINI_KEY priority, MODELS constants), but hitting 429 quota from debug test spamming. Will self-resolve in ~1 hour.
- AI personality: Working great locally — human-like tone confirmed
- Key files changed: ai-sdk.ts, 9 AI routes, debug endpoints, Google OAuth callback, page.tsx

## Unresolved Issues:
- Gemini API 429 quota (temporary, from debug testing)
- GEMINI_API_KEY on HF Spaces is invalid (24 chars) — should be deleted or replaced with the correct key
- Post-login redirect could be smoother (goes to onboarding for Google, works for guest)
- The massive page.tsx (~6585 lines) still causes occasional OOM on low-memory instances

---
Task ID: session-2026-06-08-fix2
Agent: Main Agent
Task: Fix AI not working — onboarding and mentor broken on HF Spaces

## Root Cause Analysis:
1. **PRIMARY CAUSE**: `gemini-2.0-flash` and `gemini-2.0-flash-lite` models are **SHUT DOWN** by Google (confirmed in release notes: "June 1, 2026: gemini-2.0-flash, gemini-2.0-flash-001 are now shut down")
2. This caused ALL AI endpoints to return 429/quota errors — not because of quota limits, but because the models no longer exist
3. The fallback chain used `gemini-1.5-flash` and `gemini-1.5-flash-8b` which also returned 404 (not found)

## Fix Applied:
1. **Switched to Gemini 3 family** using official Google docs (https://ai.google.dev/gemini-api/docs/gemini-3):
   - `gemini-3.1-flash-lite` — FAST model (was gemini-2.0-flash-lite) — $0.25/$1.50 per 1M tokens
   - `gemini-3-flash-preview` — SMART model (was gemini-2.0-flash) — $0.50/$3 per 1M tokens
2. **Switched SDK**: from `@google/generative-ai` (v0.24.1) to `@google/genai` (v2.8.0)
   - New SDK supports Gemini 3's `thinkingConfig.thinkingLevel` parameter
   - Uses `ai.models.generateContent()` API instead of old `genAI.getGenerativeModel().startChat().sendMessage()`
3. **Simplified fallback chain**: gemini-3.1-flash-lite ↔ gemini-3-flash-preview
4. **Updated debug endpoint** to use new SDK and test Gemini 3 models only

## Verification Results:
- `gemini-3.1-flash-lite` → ✅ SUCCESS (responds "Hello")
- `gemini-3-flash-preview` → ✅ SUCCESS (responds "hello")
- `/api/ai/onboard` → ✅ Returns human-like response with progress tracking
- `/api/ai/chat` (mentor) → ✅ Returns detailed, conversational mentor response
- Key source: GEMINI_KEY (39 chars, valid)

## Key Files Changed:
- `src/lib/ai-sdk.ts` — Complete rewrite: new SDK, new models, thinking_level support
- `src/app/api/debug/ai/route.ts` — Updated for @google/genai SDK
- `package.json` — Added @google/genai@^2.8.0

## Unresolved Issues:
- GEMINI_API_KEY on HF Spaces is invalid (24 chars) — should be deleted
- The massive page.tsx (~6585 lines) still causes occasional OOM on low-memory instances
- Should add thinking_level parameter to individual AI routes for fine-tuned control

---
Task ID: session-2026-06-08-fix3
Agent: Main Agent
Task: Add quick Google login + persistent session + remember progress/page

## Research (Case Studies):
- **Amazon/Spotify**: Long-lived sessions, skip login entirely if authenticated
- **Notion/Vercel/Figma**: Prominent Google OAuth button with branded icon, one-tap signup
- **Authgear UX Guide**: "Nothing is better than not asking the user to log in at all"
- **OWASP/WorkOS**: Regenerate session after login, persistent tokens with secure storage
- **Progressive Onboarding**: Save data as you go, indicate progress, don't lose info on dropoff

## Changes Made:
1. **Added `/api/auth/sync` endpoint** (save/load/full actions):
   - Saves: currentView, currentTab, onboardingDone, learning profile, progress, settings
   - Loads: Full user state from DB for hydration
   - Progress uses `Math.max(local, server)` — never overwrites higher progress
   - Silent failures for save (never blocks user)

2. **Added DB fields on User model**:
   - `currentView` (default: "landing") — where user left off
   - `currentTab` (default: "chat") — which tab they were on
   - `onboardingDone` (default: false) — whether onboarding is complete

3. **Auto-resume session on page load**:
   - If `sessionToken` exists and user is on landing → validate + hydrate + skip landing
   - If `sessionToken` exists and user is past landing → hydrate in background
   - If session expired → `clearAuth()` instead of stuck on broken state

4. **Auto-save to server**:
   - Every 30 seconds via `setInterval`
   - On tab close/switch via `visibilitychange` event
   - After guest signup (initial save)

5. **Proper Google "G" SVG icon** on both signup and login buttons

6. **Updated `handleResumeSession`**:
   - Uses `hydrateFromServer()` instead of manual topic check
   - Clears auth on expired session

7. **Updated Google OAuth callback**:
   - Calls `hydrateFromServer()` after setting auth
   - View/tab restored from server instead of hardcoded

## Key Files Changed:
- `prisma/schema.prisma` — Added currentView, currentTab, onboardingDone fields
- `src/app/api/auth/sync/route.ts` — NEW: sync endpoint
- `src/app/page.tsx` — Added hydrateFromServer, saveToServer, auto-resume, auto-save, Google SVG

## Unresolved Issues:
- The massive page.tsx (~6600+ lines) still causes occasional OOM on low-memory instances
- Should add CSRF state parameter to Google OAuth flow
- Should add server-side logout endpoint
- GEMINI_API_KEY on HF Spaces is invalid (24 chars) — should be deleted
