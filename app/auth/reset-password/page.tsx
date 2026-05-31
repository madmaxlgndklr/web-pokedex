'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Phase = 'verifying' | 'expired' | 'form' | 'saving'

const verifyingContent = (
  <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
      VERIFYING LINK…
    </div>
  </div>
)

function ResetContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const executed = useRef(false)

  useEffect(() => {
    if (executed.current) return
    executed.current = true

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run once; guarded by ref
  }, [])

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setError(null)
    setPhase('saving')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setPhase('form')
    } else {
      router.replace('/')
    }
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

  const primaryBtnStyle: React.CSSProperties = {
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

  if (phase === 'verifying') return verifyingContent

  if (phase === 'expired') {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
            RESET PASSWORD
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>
            This link has expired.
          </div>
          <Link
            href="/login?mode=forgot"
            style={{ ...primaryBtnStyle, textAlign: 'center', textDecoration: 'none', display: 'block' }}
          >
            REQUEST A NEW LINK
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
          NEW PASSWORD
        </div>
        <form onSubmit={e => { e.preventDefault(); handleSubmit() }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="password"
            placeholder="new password"
            aria-label="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="confirm password"
            aria-label="Confirm password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={inputStyle}
          />
          {error && (
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={phase === 'saving' || !password || !confirm}
            style={{
              ...primaryBtnStyle,
              opacity: (phase === 'saving' || !password || !confirm) ? 0.6 : 1,
              cursor: (phase === 'saving' || !password || !confirm) ? 'not-allowed' : 'pointer',
            }}
          >
            {phase === 'saving' ? 'SAVING…' : 'SET PASSWORD'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={verifyingContent}>
      <ResetContent />
    </Suspense>
  )
}
