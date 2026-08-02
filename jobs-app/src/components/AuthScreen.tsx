import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

function friendlySignInError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'The email or password is incorrect.'
  if (normalized.includes('email not confirmed')) return 'Please confirm your email before signing in.'
  if (normalized.includes('rate limit') || normalized.includes('too many')) return 'Too many attempts. Please wait a moment and try again.'
  return 'We could not sign you in. Please try again.'
}

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? friendlySignInError(error.message) : 'Signed in. Loading your applications…')
    setBusy(false)
  }

  async function sendMagicLink() {
    if (!email) {
      setMessage('Enter your email address first.')
      return
    }
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setMessage(error ? 'We could not send the sign-in link. Please try again.' : 'A secure sign-in link has been sent to your email.')
    setBusy(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">EZ</div>
        <p className="eyebrow">Private workspace</p>
        <h1>Opportunity Desk</h1>
        <p className="lede">Your applications, follow-ups and CV versions—available securely on every device.</p>
        <form onSubmit={signIn} className="auth-form">
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="button primary" disabled={busy} type="submit">{busy ? 'Please wait…' : 'Sign in'}</button>
          <button className="button secondary" disabled={busy} type="button" onClick={sendMagicLink}>Email me a sign-in link</button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
      </section>
    </main>
  )
}
