# Login — Complete Auth Design

**Date:** 2026-05-30
**Scope:** Web app only (`web-pokedex`, Next.js + Supabase JS client). Android login is a separate effort.

---

## Problem

The existing auth scaffold has three gaps:

1. **Google OAuth never completes** — `linkIdentity({ provider: 'google' })` redirects back with `?code=` (PKCE flow), but no route exchanges that code for a session.
2. **Email signup gives no feedback** — `updateUser({ email, password })` triggers a Supabase confirmation email, but the UI immediately calls `router.back()` with no "check your email" state.
3. **No password recovery** — there is no forgot-password path or reset-password page.

---

## Architecture

Three additions, minimal changes to existing files. No new npm packages.

| File | Change |
|---|---|
| `app/auth/callback/page.tsx` | **Create** — client component that reads `?code=` and calls `supabase.auth.exchangeCodeForSession(code)`, then redirects to `/` |
| `app/auth/reset-password/page.tsx` | **Create** — client component that reads `?token_hash=&type=recovery`, calls `supabase.auth.verifyOtp(...)`, then shows a new-password form |
| `app/login/page.tsx` | **Modify** — add `forgot` mode, `emailSent` state (replaces form with "check your email" message), "FORGOT PASSWORD?" link |
| `lib/auth.ts` | **Modify** — add `resetPasswordForEmail(email)` using `window.location.origin` to build `redirectTo` |

All auth remains client-side using the existing `@supabase/supabase-js` browser client (`lib/supabase.ts`). No SSR or server actions involved.

---

## Data Flows

### Google OAuth
1. User taps **CONTINUE WITH GOOGLE** → `linkIdentity({ provider: 'google' })` opens browser
2. Google consent → Supabase redirects to `/auth/callback?code=xxx`
3. `/auth/callback` calls `exchangeCodeForSession(code)` → session established
4. `onAuthStateChange` fires `SIGNED_IN` → `syncOnOpen()` runs
5. Redirect to `/`; `AccountBadge` updates to show account email

*Note:* `linkIdentity` is used (not `signInWithOAuth`) because `AuthProvider` always ensures a session exists (real or anonymous). Linking Google to the current session preserves all local Dexie data.

### Email Signup
1. User fills email/password, clicks **CREATE ACCOUNT**
2. `updateUser({ email, password })` upgrades the anonymous session in place
3. Login page replaces the form with: **"We sent a confirmation to {email}. Click the link to finish creating your account."**
4. User clicks the Supabase confirmation link → `/auth/callback?code=xxx`
5. `exchangeCodeForSession` completes the account upgrade → redirect to `/`

### Forgot Password
1. User clicks **FORGOT PASSWORD?** → login page switches to `forgot` mode (email field only)
2. User submits → `resetPasswordForEmail(email)` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth/reset-password' })`
3. Login page shows: **"Reset link sent to {email}."** (always shown — Supabase intentionally returns success for unknown emails to prevent enumeration)
4. User clicks email link → `/auth/reset-password?token_hash=xxx&type=recovery`
5. Page calls `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })` → recovery session established
6. User enters and confirms new password → `supabase.auth.updateUser({ password })` → redirect to `/`

---

## Login Page State Machine

```
Mode: 'signin' | 'signup' | 'forgot'
emailSent: string | null   (when set, replaces form with "check your email" message)
```

- **signin** (default): Google button + email/password + SIGN IN button + "FORGOT PASSWORD?" link
- **signup**: Google button + email/password + CREATE ACCOUNT button
- **forgot**: email field only + SEND RESET EMAIL button + BACK TO SIGN IN link
- **emailSent** (any mode): shows confirmation/reset message + BACK TO SIGN IN button (clears `emailSent`, sets mode to `signin`)

Mode tabs only show `signin` / `signup` — `forgot` is accessed via link, not a tab.

---

## Error Handling

| Surface | Failure | Behaviour |
|---|---|---|
| `/auth/callback` | `exchangeCodeForSession` fails (expired/used code) | Show inline error + "BACK TO SIGN IN" link |
| `/auth/reset-password` | Missing `token_hash` or `type` param | Immediate redirect to `/login` |
| `/auth/reset-password` | `verifyOtp` fails (expired link) | Show "This link has expired" + "REQUEST A NEW LINK" button (links to `/login` in forgot mode) |
| `/auth/reset-password` | `updateUser` fails | Show error inline, keep form visible for retry |
| Login page | Any Supabase error | Show in existing red error text (already implemented) |

---

## Supabase Dashboard Configuration Required

Under **Authentication → URL Configuration**, add to the Redirect URLs allow-list:
- `https://web-pokedex-seven.vercel.app/auth/callback`
- `https://web-pokedex-seven.vercel.app/auth/reset-password`

Without these, Supabase rejects the OAuth and email link redirects.

---

## File Map

| File | What changes |
|---|---|
| `lib/auth.ts` | Add `resetPasswordForEmail(email: string): Promise<void>` |
| `app/login/page.tsx` | Add `forgot` mode, `emailSent` state, "FORGOT PASSWORD?" link, `handleForgot` handler |
| `app/auth/callback/page.tsx` | New file — PKCE code exchange |
| `app/auth/reset-password/page.tsx` | New file — OTP verification + new password form |
