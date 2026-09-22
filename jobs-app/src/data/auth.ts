import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function sendMagicLink(email: string, redirectTo: string) {
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
}

export function readSession() {
  return supabase.auth.getSession()
}

export function watchSession(onChange: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, nextSession) => onChange(nextSession))
}
