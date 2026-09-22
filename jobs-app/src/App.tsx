import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { Workspace } from './components/Workspace'
import { clearGoogleAccess } from './lib/google'
import { readSession, watchSession } from './data/auth'

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
    void readSession().then(({ data }) => applySession(data.session))
    const { data } = watchSession(applySession)
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return <main className="loading-screen">Opening your private workspace…</main>
  return session ? <Workspace session={session} /> : <AuthScreen />
}
