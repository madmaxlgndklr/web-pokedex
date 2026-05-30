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

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.updateUser({ email, password })
  if (error) throw error
  return data.user
}

export async function linkGoogle() {
  const { error } = await supabase.auth.linkIdentity({ provider: 'google' })
  if (error) throw error
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
