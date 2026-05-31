'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { signInAnonymously } from '@/lib/auth'
import { syncOnOpen } from '@/lib/sync'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session)
        setUser(session.user)
      } else {
        try {
          const anonUser = await signInAnonymously()
          setUser(anonUser)
        } catch (e) {
          console.warn('[AuthProvider] Anonymous sign-in failed (check Supabase dashboard → Authentication → Settings → Enable anonymous sign-ins):', e)
          // stay unauthenticated — app still works offline
        }
      }
      setLoading(false)
      syncOnOpen().catch(() => {})
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        syncOnOpen().catch(() => {})
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
