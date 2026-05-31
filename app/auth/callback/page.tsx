'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const loadingContent = (
  <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
      SIGNING IN…
    </div>
  </div>
)

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const executed = useRef(false)

  useEffect(() => {
    if (executed.current) return
    executed.current = true

    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(searchParams.get('error_description') || errorParam)
      return
    }

    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code found.')
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (!error) {
        router.replace('/')
        return
      }
      // detectSessionInUrl may have already consumed the code — check for existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace('/')
        } else {
          setError(error.message)
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run once; guarded by ref
  }, [])

  if (error) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
            SIGN IN FAILED
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>{error}</div>
          <Link
            href="/login"
            style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            BACK TO SIGN IN
          </Link>
        </div>
      </div>
    )
  }

  return loadingContent
}

export default function CallbackPage() {
  return (
    <Suspense fallback={loadingContent}>
      <CallbackContent />
    </Suspense>
  )
}
