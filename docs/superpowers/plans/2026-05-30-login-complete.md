# Login — Complete Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the three auth gaps — Google OAuth callback, email signup confirmation state, and forgot-password flow.

**Architecture:** Four focused files: `lib/auth.ts` gains one new function; `app/login/page.tsx` gains a third mode and email-sent state; two new client-component pages handle OAuth PKCE exchange and password reset. All client-side via existing `@supabase/supabase-js` browser client. No new npm packages.

**Tech Stack:** Next.js 14 App Router, Supabase JS client (`lib/supabase.ts`), React hooks, Vitest + jsdom, `@testing-library/react`

---

## File Map

| File | Change |
|---|---|
| `lib/auth.ts` | Add `resetPasswordForEmail(email)` |
| `src/test/auth.test.ts` | New — unit tests for `resetPasswordForEmail` |
| `app/auth/callback/page.tsx` | New — PKCE code exchange client component |
| `app/auth/reset-password/page.tsx` | New — OTP verification + new-password form |
| `app/login/page.tsx` | Modify — add `forgot` mode, `emailSent` state, `?mode=forgot` param, "FORGOT PASSWORD?" link |

---

### Task 1: Add `resetPasswordForEmail` to `lib/auth.ts`

**Files:**
- Modify: `lib/auth.ts`
- Create: `src/test/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

import { resetPasswordForEmail } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const mockReset = supabase.auth.resetPasswordForEmail as ReturnType<typeof vi.fn>

describe('resetPasswordForEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls supabase with email and a redirectTo pointing to /auth/reset-password', async () => {
    mockReset.mockResolvedValue({ data: {}, error: null })

    await resetPasswordForEmail('user@example.com')

    expect(mockReset).toHaveBeenCalledOnce()
    const [calledEmail, opts] = mockReset.mock.calls[0]
    expect(calledEmail).toBe('user@example.com')
    expect(opts.redirectTo).toContain('/auth/reset-password')
  })

  it('throws when supabase returns an error', async () => {
    mockReset.mockResolvedValue({ data: {}, error: { message: 'Rate limit exceeded' } })

    await expect(resetPasswordForEmail('user@example.com')).rejects.toThrow('Rate limit exceeded')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npm test -- src/test/auth.test.ts
```

Expected: FAIL — `resetPasswordForEmail` not exported from `lib/auth`

- [ ] **Step 3: Implement the function**

Add to the bottom of `lib/auth.ts`:

```typescript
export async function resetPasswordForEmail(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/auth/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}
```

Also add `resetPasswordForEmail` to the import in `app/login/page.tsx` when modifying it in Task 4 — no change needed here yet.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npm test -- src/test/auth.test.ts
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npm test
```

Expected: all existing tests still passing

- [ ] **Step 6: Commit**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex
git add lib/auth.ts src/test/auth.test.ts
git commit -m "feat: add resetPasswordForEmail to auth lib"
```

---

### Task 2: Create `/auth/callback` — PKCE Code Exchange

**Files:**
- Create: `app/auth/callback/page.tsx`

This page receives `?code=xxx` after Google OAuth or email confirmation, exchanges it for a session, and redirects to `/`. It shows an error with a "BACK TO SIGN IN" link if the exchange fails.

- [ ] **Step 1: Create the file**

Create `app/auth/callback/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code found.')
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message)
      } else {
        router.replace('/')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
            SIGN IN FAILED
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>{error}</div>
          <a
            href="/login"
            style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            BACK TO SIGN IN
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
        SIGNING IN…
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify the build compiles without errors**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (the `/auth/callback` route should appear in the route list as `ƒ (Dynamic)`)

- [ ] **Step 3: Commit**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex
git add app/auth/callback/page.tsx
git commit -m "feat: add /auth/callback for PKCE code exchange"
```

---

### Task 3: Create `/auth/reset-password` — OTP Verification and New Password Form

**Files:**
- Create: `app/auth/reset-password/page.tsx`

Flow:
1. Read `?token_hash=` and `?type=` from URL. If either is missing, redirect immediately to `/login`.
2. Call `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`.
3. If verifyOtp fails → show "This link has expired" + "REQUEST A NEW LINK" button linking to `/login?mode=forgot`.
4. If verifyOtp succeeds → show a new-password form (password + confirm).
5. On submit, validate passwords match, call `supabase.auth.updateUser({ password })`.
6. On success → redirect to `/`.
7. On updateUser failure → show inline error, keep form.

- [ ] **Step 1: Create the file**

Create `app/auth/reset-password/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

type Phase = 'verifying' | 'expired' | 'form' | 'saving'

function ResetContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    if (!token_hash || type !== 'recovery') {
      router.replace('/login')
      return
    }
    supabase.auth.verifyOtp({ token_hash, type: 'recovery' }).then(({ error }) => {
      if (error) setPhase('expired')
      else setPhase('form')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setError(null)
    setPhase('saving')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setPhase('form')
    } else {
      router.replace('/')
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  }
  const panelStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '24px',
    width: '100%',
    maxWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }
  const inputStyle: React.CSSProperties = {
    padding: '8px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text)',
    fontFamily: 'monospace',
    fontSize: '12px',
  }
  const btnStyle: React.CSSProperties = {
    padding: '10px 16px',
    background: 'var(--blue)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontFamily: 'var(--font-pixel)',
    fontSize: '6px',
    letterSpacing: '0.5px',
    cursor: 'pointer',
  }

  if (phase === 'verifying') {
    return (
      <div style={cardStyle}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
          VERIFYING LINK…
        </div>
      </div>
    )
  }

  if (phase === 'expired') {
    return (
      <div style={cardStyle}>
        <div style={panelStyle}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
            RESET PASSWORD
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>
            This link has expired.
          </div>
          <a
            href="/login?mode=forgot"
            style={{ ...btnStyle, textAlign: 'center', textDecoration: 'none', display: 'block' }}
          >
            REQUEST A NEW LINK
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={panelStyle}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
          NEW PASSWORD
        </div>
        <input
          type="password"
          placeholder="new password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="confirm password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          style={inputStyle}
        />
        {error && (
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>{error}</div>
        )}
        <button
          onClick={handleSubmit}
          disabled={phase === 'saving' || !password || !confirm}
          style={{ ...btnStyle, opacity: (phase === 'saving' || !password || !confirm) ? 0.6 : 1, cursor: (phase === 'saving' || !password || !confirm) ? 'not-allowed' : 'pointer' }}
        >
          {phase === 'saving' ? 'SAVING…' : 'SET PASSWORD'}
        </button>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify the build compiles without errors**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`, `/auth/reset-password` appears as `ƒ (Dynamic)`

- [ ] **Step 3: Commit**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex
git add app/auth/reset-password/page.tsx
git commit -m "feat: add /auth/reset-password with OTP verification and password form"
```

---

### Task 4: Modify `app/login/page.tsx` — Forgot Mode and Email-Sent State

**Files:**
- Modify: `app/login/page.tsx`

Changes:
- `Mode` type gains `'forgot'`
- New state: `emailSent: string | null` — when set, replaces the form with a "check your email" message
- New handler `handleForgot` calling `resetPasswordForEmail(email)`
- Read `?mode=forgot` via `useSearchParams` (wrapped in Suspense) to pre-set forgot mode on arrival from reset-password page
- "FORGOT PASSWORD?" link appears below the SIGN IN button in `signin` mode
- `forgot` mode shows: email field only, "SEND RESET EMAIL" button, "BACK TO SIGN IN" link (no password field, no tabs)
- `emailSent` state (any mode): full-card replacement with confirmation text + "BACK TO SIGN IN" button
- In `signup` mode after `signUpWithEmail`, set `emailSent` to the email instead of calling `router.back()`

- [ ] **Step 1: Replace `app/login/page.tsx` with the full updated version**

```tsx
'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmail, signUpWithEmail, linkGoogle, resetPasswordForEmail } from '@/lib/auth'

type Mode = 'signin' | 'signup' | 'forgot'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('mode') === 'forgot') setMode('forgot')
  }, [searchParams])

  const handleEmail = async () => {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
        router.back()
      } else {
        await signUpWithEmail(email, password)
        setEmailSent(email)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      await linkGoogle()
      // Google OAuth redirects — no router.back() needed here
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed')
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    setError(null)
    setLoading(true)
    try {
      await resetPasswordForEmail(email)
      setEmailSent(email)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  const backToSignIn = () => {
    setEmailSent(null)
    setMode('signin')
    setError(null)
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text)',
    fontFamily: 'monospace',
    fontSize: '12px',
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
          SYNC ACCOUNT
        </div>

        {emailSent ? (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 }}>
              {mode === 'forgot'
                ? `Reset link sent to ${emailSent}.`
                : `We sent a confirmation to ${emailSent}. Click the link to finish creating your account.`}
            </div>
            <button
              onClick={backToSignIn}
              style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', textAlign: 'left' }}
            >
              BACK TO SIGN IN
            </button>
          </>
        ) : mode === 'forgot' ? (
          <>
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleForgot() }}
              style={inputStyle}
            />
            {error && (
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>{error}</div>
            )}
            <button
              onClick={handleForgot}
              disabled={loading || !email}
              style={{ padding: '10px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', letterSpacing: '0.5px', cursor: (loading || !email) ? 'not-allowed' : 'pointer', opacity: (loading || !email) ? 0.7 : 1 }}
            >
              SEND RESET EMAIL
            </button>
            <button
              onClick={backToSignIn}
              style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', textAlign: 'left' }}
            >
              BACK TO SIGN IN
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{ padding: '10px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', letterSpacing: '0.5px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              CONTINUE WITH GOOGLE
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            <div style={{ display: 'flex', gap: '0' }}>
              {(['signin', 'signup'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null) }}
                  style={{ flex: 1, padding: '6px', fontFamily: 'var(--font-pixel)', fontSize: '6px', background: mode === m ? 'var(--blue)' : 'transparent', color: mode === m ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  {m === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </button>
              ))}
            </div>

            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEmail() }}
              style={inputStyle}
            />

            {error && (
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>{error}</div>
            )}

            <button
              onClick={handleEmail}
              disabled={loading || !email || !password}
              style={{ padding: '10px 16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', letterSpacing: '0.5px', cursor: (loading || !email || !password) ? 'not-allowed' : 'pointer', opacity: (loading || !email || !password) ? 0.6 : 1 }}
            >
              {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>

            {mode === 'signin' && (
              <button
                onClick={() => { setMode('forgot'); setError(null) }}
                style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', textAlign: 'left' }}
              >
                FORGOT PASSWORD?
              </button>
            )}

            <button
              onClick={() => router.back()}
              style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              BACK
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Run the full test suite**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npm test
```

Expected: all tests passing

- [ ] **Step 3: Verify the build compiles without errors**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`. `/login` may now show as `ƒ (Dynamic)` rather than `○ (Static)` — this is expected because `useSearchParams` makes it dynamic.

- [ ] **Step 4: Commit**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex
git add app/login/page.tsx
git commit -m "feat: add forgot-password mode and email-sent confirmation to login page"
```

---

### Task 5: Deploy to Vercel and Verify Supabase Config

**Files:** (no code changes)

- [ ] **Step 1: Deploy to production**

```bash
/home/madmaxlgndklr/.npm/_npx/69f9afb961c37556/node_modules/.bin/vercel --prod --yes 2>&1 | tail -10
```

Expected: `▲ Aliased https://web-pokedex-seven.vercel.app` and `"readyState": "READY"`

- [ ] **Step 2: Remind user to add Supabase redirect URLs**

In Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs**, add:
- `https://web-pokedex-seven.vercel.app/auth/callback`
- `https://web-pokedex-seven.vercel.app/auth/reset-password`

Without these, Supabase rejects OAuth and email link redirects with a "Redirect URL not allowed" error.

- [ ] **Step 3: Smoke-test each flow manually**

  **Google OAuth:**
  1. Open `https://web-pokedex-seven.vercel.app/login`
  2. Click **CONTINUE WITH GOOGLE** → complete Google consent
  3. Verify redirect lands on `/` with account email visible in AccountBadge

  **Email signup:**
  1. Switch to **CREATE ACCOUNT** tab, enter email/password, click **CREATE ACCOUNT**
  2. Verify form is replaced by "We sent a confirmation to {email}…" message
  3. Click the link in the Supabase email → verify redirect to `/` and account is active

  **Forgot password:**
  1. Click **FORGOT PASSWORD?** → verify mode switches (no password field, "SEND RESET EMAIL" button)
  2. Enter email, click **SEND RESET EMAIL** → verify "Reset link sent to {email}." message
  3. Click the link in the Supabase email → verify `/auth/reset-password` shows password form
  4. Enter and confirm new password → verify redirect to `/`
  5. Sign out, sign in with new password → verify success

  **Expired reset link:**
  1. Click an old reset link → verify "This link has expired" with **REQUEST A NEW LINK** button
  2. Click **REQUEST A NEW LINK** → verify `/login` opens in forgot mode

---

## Self-Review Notes

- **Spec coverage:** All 4 data flows covered (Google OAuth → callback, email signup → emailSent, forgot password → reset-password). All error surfaces from spec covered. Supabase dashboard config step included.
- **No placeholders:** All code is complete and concrete.
- **Type consistency:** `Mode = 'signin' | 'signup' | 'forgot'` defined once in Task 4. `resetPasswordForEmail` signature matches between Task 1 definition and Task 4 import. `Phase = 'verifying' | 'expired' | 'form' | 'saving'` is local to Task 3.
- **Note on `/login` becoming dynamic:** The `Suspense` wrapper keeps the page from crashing during SSR, but `useSearchParams` means Next.js will render it dynamically. This is fine — login is not a page that benefits from static pre-rendering.
