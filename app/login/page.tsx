'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmail, signUpWithEmail, linkGoogle, resetPasswordForEmail } from '@/lib/auth'

type Mode = 'signin' | 'signup' | 'forgot'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode') === 'forgot' ? 'forgot' : 'signin'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState<{ address: string; type: 'reset' | 'signup' } | null>(null)

  const handleEmail = async () => {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
        router.back()
      } else {
        await signUpWithEmail(email, password)
        setEmailSent({ address: email, type: 'signup' })
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
      setEmailSent({ address: email, type: 'reset' })
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
    if (window.location.search) router.replace('/login')
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
              {emailSent.type === 'reset'
                ? `Reset link sent to ${emailSent.address}.`
                : `We sent a confirmation email to ${emailSent.address}. Click the link to activate your account.`}
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
              aria-label="Email"
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
              aria-label="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="password"
              aria-label="Password"
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
  const fallback = (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
          SYNC ACCOUNT
        </div>
      </div>
    </div>
  )
  return (
    <Suspense fallback={fallback}>
      <LoginContent />
    </Suspense>
  )
}
