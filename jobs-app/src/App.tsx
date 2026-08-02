import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { Workspace } from './components/Workspace'
import { clearGoogleAccess } from './lib/google'
import { supabase } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const activeUserId = useRef<string | null>(null)

  useEffect(() => {
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null
      if (activeUserId.current !== nextUserId) clearGoogleAccess()
      activeUserId.current = nextUserId
      setSession(nextSession)
      setReady(true)
    }
    void supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => applySession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return <main className="loading-screen">Opening your private workspace…</main>
  return session ? <Workspace session={session} /> : <AuthScreen />
}
