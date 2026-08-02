import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { EMPTY_JOB, JOB_STATUSES, type Job, type JobDraft, type JobStatus } from './types'

const statusLabels: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
}

function clean(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

function friendlySignInError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'The email or password is incorrect.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }

  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  return 'We could not sign you in. Please try again.'
}

function toDraft(job: Job): JobDraft {
  return {
    company: job.company,
    role_title: job.role_title,
    status: job.status,
    location: job.location ?? '',
    job_url: job.job_url ?? '',
    source: job.source ?? '',
    salary_text: job.salary_text ?? '',
    contact_name: job.contact_name ?? '',
    contact_email: job.contact_email ?? '',
    applied_at: job.applied_at ?? '',
    next_action_at: job.next_action_at ? job.next_action_at.slice(0, 16) : '',
    notes: job.notes ?? '',
  }
}

function AuthScreen() {
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
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="button primary" disabled={busy} type="submit">{busy ? 'Please wait…' : 'Sign in'}</button>
          <button className="button secondary" disabled={busy} type="button" onClick={sendMagicLink}>Email me a sign-in link</button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
      </section>
    </main>
  )
}

type JobFormProps = {
  initial: JobDraft
  title: string
  busy: boolean
  onCancel: () => void
  onSave: (draft: JobDraft) => Promise<void>
}

function JobForm({ initial, title, busy, onCancel, onSave }: JobFormProps) {
  const [draft, setDraft] = useState<JobDraft>(initial)

  function field<K extends keyof JobDraft>(key: K, value: JobDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="job-form-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Application record</p>
            <h2 id="job-form-title">{title}</h2>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="Close form">×</button>
        </div>
        <form className="job-form" onSubmit={(event) => { event.preventDefault(); void onSave(draft) }}>
          <label>Company<input value={draft.company} onChange={(event) => field('company', event.target.value)} required /></label>
          <label>Role title<input value={draft.role_title} onChange={(event) => field('role_title', event.target.value)} required /></label>
          <label>Status<select value={draft.status} onChange={(event) => field('status', event.target.value as JobStatus)}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          <label>Location<input value={draft.location} onChange={(event) => field('location', event.target.value)} /></label>
          <label>Job link<input type="url" value={draft.job_url} onChange={(event) => field('job_url', event.target.value)} placeholder="https://" /></label>
          <label>Source<input value={draft.source} onChange={(event) => field('source', event.target.value)} placeholder="LinkedIn, recruiter…" /></label>
          <label>Salary / package<input value={draft.salary_text} onChange={(event) => field('salary_text', event.target.value)} /></label>
          <label>Contact name<input value={draft.contact_name} onChange={(event) => field('contact_name', event.target.value)} /></label>
          <label>Contact email<input type="email" value={draft.contact_email} onChange={(event) => field('contact_email', event.target.value)} /></label>
          <label>Applied date<input type="date" value={draft.applied_at} onChange={(event) => field('applied_at', event.target.value)} /></label>
          <label>Next action<input type="datetime-local" value={draft.next_action_at} onChange={(event) => field('next_action_at', event.target.value)} /></label>
          <label className="full">Notes<textarea rows={5} value={draft.notes} onChange={(event) => field('notes', event.target.value)} /></label>
          <div className="form-actions full">
            <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>
            <button className="button primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save application'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Dashboard({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | JobStatus>('all')
  const [editing, setEditing] = useState<Job | 'new' | null>(null)

  const loadJobs = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('jobs')
      .select('*')
      .order('updated_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else {
      setJobs((data ?? []) as Job[])
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadJobs()
    const channel = supabase
      .channel(`jobs-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `user_id=eq.${session.user.id}` }, () => void loadJobs())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadJobs, session.user.id])

  const visibleJobs = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return jobs.filter((job) => {
      const matchesStatus = filter === 'all' || job.status === filter
      const matchesSearch = !needle || [job.company, job.role_title, job.location ?? '', job.contact_name ?? ''].some((value) => value.toLowerCase().includes(needle))
      return matchesStatus && matchesSearch
    })
  }, [filter, jobs, search])

  const counts = useMemo(() => ({
    active: jobs.filter((job) => ['saved', 'applied', 'interviewing'].includes(job.status)).length,
    interviews: jobs.filter((job) => job.status === 'interviewing').length,
    offers: jobs.filter((job) => job.status === 'offer').length,
    followUps: jobs.filter((job) => job.next_action_at && new Date(job.next_action_at) >= new Date()).length,
  }), [jobs])

  async function saveJob(draft: JobDraft) {
    setBusy(true)
    setError('')
    const payload = {
      company: draft.company.trim(),
      role_title: draft.role_title.trim(),
      status: draft.status,
      location: clean(draft.location),
      job_url: clean(draft.job_url),
      source: clean(draft.source),
      salary_text: clean(draft.salary_text),
      contact_name: clean(draft.contact_name),
      contact_email: clean(draft.contact_email),
      applied_at: clean(draft.applied_at),
      next_action_at: draft.next_action_at ? new Date(draft.next_action_at).toISOString() : null,
      notes: clean(draft.notes),
      data: {},
    }
    const result = editing === 'new'
      ? await supabase.from('jobs').insert({ ...payload, user_id: session.user.id })
      : await supabase.from('jobs').update(payload).eq('id', editing!.id).eq('version', editing!.version)
    if (result.error) setError(result.error.message)
    else {
      setEditing(null)
      await loadJobs()
    }
    setBusy(false)
  }

  async function deleteJob(job: Job) {
    if (!window.confirm(`Delete ${job.role_title} at ${job.company}? This cannot be undone.`)) return
    setBusy(true)
    const { error: deleteError } = await supabase.from('jobs').delete().eq('id', job.id)
    if (deleteError) setError(deleteError.message)
    else await loadJobs()
    setBusy(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark small">EZ</span><div><strong>Opportunity Desk</strong><span>Private career workspace</span></div></div>
        <div className="account"><span>{session.user.email}</span><button className="button ghost" onClick={() => void supabase.auth.signOut()}>Sign out</button></div>
      </header>
      <main className="dashboard">
        <section className="welcome-row">
          <div><p className="eyebrow">Application command centre</p><h1>Stay ahead of every opportunity.</h1><p>One secure view of your pipeline, follow-ups and next decisions.</p></div>
          <button className="button primary add-button" onClick={() => setEditing('new')}>+ Add application</button>
        </section>
        <section className="metrics" aria-label="Application summary">
          <article><span>Active pipeline</span><strong>{counts.active}</strong></article>
          <article><span>Interviews</span><strong>{counts.interviews}</strong></article>
          <article><span>Offers</span><strong>{counts.offers}</strong></article>
          <article><span>Upcoming actions</span><strong>{counts.followUps}</strong></article>
        </section>
        <section className="workspace-card">
          <div className="workspace-head"><div><p className="eyebrow">Your pipeline</p><h2>Applications</h2></div><div className="controls"><input aria-label="Search applications" placeholder="Search company or role" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | JobStatus)}><option value="all">All statuses</option>{JOB_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div></div>
          {error && <div className="error-banner" role="alert">{error}</div>}
          {loading ? <div className="empty-state">Loading your applications…</div> : visibleJobs.length === 0 ? <div className="empty-state"><strong>{jobs.length ? 'No matching applications' : 'Your pipeline is ready'}</strong><span>{jobs.length ? 'Try a different search or status.' : 'Add your first opportunity to start tracking it across devices.'}</span></div> : <div className="job-list">{visibleJobs.map((job) => <article className="job-card" key={job.id}><div className="job-main"><span className={`status ${job.status}`}>{statusLabels[job.status]}</span><h3>{job.role_title}</h3><p className="company">{job.company}{job.location ? ` · ${job.location}` : ''}</p><div className="job-meta">{job.applied_at && <span>Applied {new Date(`${job.applied_at}T00:00:00`).toLocaleDateString()}</span>}{job.next_action_at && <span>Next: {new Date(job.next_action_at).toLocaleString()}</span>}{job.contact_name && <span>Contact: {job.contact_name}</span>}</div></div><div className="job-actions">{job.job_url && <a className="button ghost" href={job.job_url} target="_blank" rel="noreferrer">Open role</a>}<button className="button secondary" onClick={() => setEditing(job)}>Edit</button><button className="button danger" disabled={busy} onClick={() => void deleteJob(job)}>Delete</button></div></article>)}</div>}
        </section>
      </main>
      {editing && <JobForm initial={editing === 'new' ? EMPTY_JOB : toDraft(editing)} title={editing === 'new' ? 'Add an opportunity' : 'Update application'} busy={busy} onCancel={() => setEditing(null)} onSave={saveJob} />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setReady(true) })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return <main className="loading-screen">Opening your private workspace…</main>
  return session ? <Dashboard session={session} /> : <AuthScreen />
}
