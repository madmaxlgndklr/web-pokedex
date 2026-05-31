import { supabase } from './supabase'

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.user
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

// updateUser upgrades the current anonymous session to an email account (preserves local data).
// Falls back to signUp when no session exists (anonymous auth disabled or expired).
export async function signUpWithEmail(email: string, password: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
  const emailRedirectTo = `${origin}/auth/callback`
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const { data, error } = await supabase.auth.updateUser({ email, password }, { emailRedirectTo })
    if (error) throw error
    return data.user
  }
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
  if (error) throw error
  return data.user
}

// linkIdentity attaches Google to the current session (preserves local data).
// Falls back to signInWithOAuth when no session exists.
export async function linkGoogle() {
  const { data: { session } } = await supabase.auth.getSession()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
  if (session) {
    const { error } = await supabase.auth.linkIdentity({ provider: 'google' })
    if (error) throw error
  } else {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback` },
    })
    if (error) throw error
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  await supabase.auth.signInAnonymously()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
  const redirectTo = `${origin}/auth/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}
