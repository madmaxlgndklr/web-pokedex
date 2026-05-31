'use client'
import { useAuth } from '@/components/auth/AuthProvider'
import { useSetting } from '@/lib/db'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [trainerName, setTrainerName] = useSetting('trainerName', '')
  const [draft, setDraft] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [saving, setSaving] = useState(false)

  if (loading) return null

  const isAnonymous = !user || user.is_anonymous
  const displayed = draft ?? trainerName

  const handleSave = async () => {
    if (draft !== null && draft !== trainerName) {
      setSaving(true)
      try {
        await setTrainerName(draft)
        setDraft(null)
      } finally {
        setSaving(false)
      }
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out failed:', err)
    } finally {
      setSigningOut(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text)',
    fontFamily: 'monospace',
    fontSize: '13px',
  }

  const pixelLabel: React.CSSProperties = {
    fontFamily: 'var(--font-pixel)',
    fontSize: '6px',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 24px', maxWidth: '480px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: 'var(--gold)', letterSpacing: '1px', marginBottom: '28px' }}>
        TRAINER PROFILE
      </div>

      {/* ── Trainer Name ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
        <div style={pixelLabel}>TRAINER NAME</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={displayed}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            maxLength={16}
            placeholder="YOUR NAME"
            style={inputStyle}
          />
          <button
            onClick={handleSave}
            disabled={draft === null || draft === trainerName || saving}
            style={{
              padding: '8px 14px',
              background: 'var(--blue)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'var(--font-pixel)',
              fontSize: '6px',
              cursor: draft === null || draft === trainerName || saving ? 'not-allowed' : 'pointer',
              opacity: draft === null || draft === trainerName || saving ? 0.45 : 1,
            }}
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* ── Auth / Sync ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={pixelLabel}>SYNC ACCOUNT</div>

        {isAnonymous ? (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Not signed in. Your data stays on this device.
            </div>
            <button
              onClick={() => router.push('/login')}
              style={{ padding: '10px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              SIGN IN / CREATE ACCOUNT
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--gold)', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(user.email ?? 'GOOGLE ACCOUNT').toUpperCase()}
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: signingOut ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
            >
              {signingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
