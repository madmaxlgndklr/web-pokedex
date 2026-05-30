'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { signOut } from '@/lib/auth'
import { useState } from 'react'

export function AccountBadge() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  if (loading) return null

  const isAnonymous = !user || user.is_anonymous

  if (isAnonymous) {
    return (
      <button
        onClick={() => router.push('/login')}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '6px 8px',
          fontFamily: 'var(--font-pixel)',
          fontSize: '5px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          letterSpacing: '0.5px',
          textAlign: 'left',
          width: '100%',
        }}
      >
        SIGN IN TO SYNC
      </button>
    )
  }

  const displayName = user.email ?? 'GOOGLE ACCOUNT'

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: '#f0c040', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayName.toUpperCase()}
      </div>
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          padding: '4px 6px',
          fontFamily: 'var(--font-pixel)',
          fontSize: '5px',
          color: 'var(--text-muted)',
          cursor: signingOut ? 'not-allowed' : 'pointer',
          opacity: signingOut ? 0.6 : 1,
        }}
      >
        SIGN OUT
      </button>
    </div>
  )
}
