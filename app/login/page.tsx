'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmail, signUpWithEmail, linkGoogle } from '@/lib/auth'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleEmail = async () => {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
      router.back()
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
          SYNC ACCOUNT
        </div>

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
          {(['signin', 'signup'] as Mode[]).map(m => (
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
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', fontFamily: 'monospace', fontSize: '12px' }}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleEmail() }}
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', fontFamily: 'monospace', fontSize: '12px' }}
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

        <button
          onClick={() => router.back()}
          style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
        >
          BACK
        </button>
      </div>
    </div>
  )
}
