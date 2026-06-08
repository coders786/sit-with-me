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
