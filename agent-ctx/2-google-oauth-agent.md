# Task 2: Google OAuth and Google Services Integration

## Agent: Google OAuth Agent
## Date: 2026-06-06

## Summary
Implemented full Google OAuth integration using NextAuth.js v4 with extended scopes for Calendar, Tasks, and Gmail. All Google API routes now use automatic token refresh. Frontend buttons redirect to real OAuth flow instead of demo mode.

## Files Modified
1. **`prisma/schema.prisma`** — Added `googleRefreshToken String?` and `googleTokenExpiry DateTime?` to User model
2. **`src/app/api/auth/[...nextauth]/route.ts`** — NEW: NextAuth configuration with GoogleProvider, extended scopes, signIn/session callbacks
3. **`src/lib/google-auth.ts`** — NEW: Token refresh helper (`getValidGoogleToken`)
4. **`src/app/api/google/calendar/route.ts`** — Updated to use `getValidGoogleToken`, returns `needsReauth` on failure
5. **`src/app/api/google/tasks/route.ts`** — Updated to use `getValidGoogleToken`, returns `needsReauth` on failure
6. **`src/app/api/google/gmail/route.ts`** — Updated with token refresh + new `read` and `get` actions
7. **`src/app/api/google/connect/route.ts`** — Updated to accept `accessToken`, `refreshToken`, `email`, `expiresAt`, `providerId`
8. **`src/app/api/auth/me/route.ts`** — Added GET handler with `x-session-token` header support
9. **`src/app/page.tsx`** — Updated 4 Google-related buttons/callbacks, added OAuth callback useEffect, added Reconnect/Disconnect in Settings
10. **`.env`** — Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

## Key Decisions
- Used `prompt: 'consent'` and `access_type: 'offline'` in Google OAuth params to ensure refresh tokens are returned
- Token refresh happens transparently in `getValidGoogleToken()` — API routes don't need to worry about expiry
- Gmail `read` action fetches messages with metadata only (not full body) for performance; `get` action fetches full body
- OAuth callback uses URL parameter `googleConnected=true` to trigger session lookup flow
- `NEXTAUTH_SECRET` auto-generated with `openssl rand -base64 32`

## Testing Notes
- NextAuth endpoints verified: `/api/auth/signin` returns 302 redirect, `/api/auth/session` returns `{}`
- Dev server responds 200 OK
- ESLint passes with 0 errors, 0 warnings
- ⚠️ Full OAuth flow requires real `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
