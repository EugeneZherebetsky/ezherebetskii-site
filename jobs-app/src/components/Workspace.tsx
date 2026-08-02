import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { cvToDraft, formatFileSize, safeStorageFilename, validateCVFile } from '../lib/cvs'
import {
  ACTIVE_STATUSES,
  BOARD_COLUMNS,
  downloadText,
  draftToPayload,
  formatDateTime,
  isJobStatus,
  isPriority,
  isWorkMode,
  jobMatches,
  jobsToCsv,
  relativeDueLabel,
  toLocalDateTimeInput,
  toDraft,
} from '../lib/opportunities'
import {
  APP_VIEWS,
  EMPTY_CV,
  EMPTY_JOB,
  JOB_STATUSES,
  STATUS_LABELS,
  type AppView,
  type CV,
  type CVDraft,
  type DefaultView,
  type Job,
  type JobDraft,
  type JobStatus,
  type SettingsDraft,
  type UserSettings,
} from '../types'
import { CVForm } from './CVForm'
import { JobForm } from './JobForm'

const NAV_ITEMS: Array<{ view: AppView; label: string; symbol: string }> = [
  { view: 'dashboard', label: 'Dashboard', symbol: '◫' },
  { view: 'board', label: 'Board', symbol: '▦' },
  { view: 'applications', label: 'Applications', symbol: '≡' },
  { view: 'reminders', label: 'Reminders', symbol: '◷' },
  { view: 'cvs', label: 'CV library', symbol: '▤' },
  { view: 'search', label: 'Find jobs', symbol: '⌕' },
  { view: 'backup', label: 'Backup', symbol: '⇅' },
  { view: 'settings', label: 'Settings', symbol: '⚙' },
]

function currentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function defaultSettings(userId: string): UserSettings {
  const now = new Date().toISOString()
  return {
    user_id: userId,
    default_view: 'dashboard',
    reminders_enabled: true,
    reminder_lead_hours: 24,
    timezone: currentTimezone(),
    created_at: now,
    updated_at: now,
    version: 1,
  }
}

function viewTitle(view: AppView) {
  return NAV_ITEMS.find((item) => item.view === view)?.label ?? 'Opportunity Desk'
}

function legacyStatus(value: unknown): JobStatus {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const statuses: Record<string, JobStatus> = {
    wishlist: 'saved',
    saved: 'saved',
    applied: 'applied',
    'phone screen': 'phone_screen',
    interview: 'interviewing',
    interviewing: 'interviewing',
    assessment: 'assessment',
    'final round': 'final_round',
    offer: 'offer',
    accepted: 'accepted',
    rejected: 'rejected',
    withdrawn: 'withdrawn',
    'on hold': 'on_hold',
    closed: 'closed',
  }
  return statuses[normalized] ?? 'saved'
}

function legacyWorkMode(value: unknown): JobDraft['work_mode'] {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'remote' || normalized === 'hybrid') return normalized
  if (normalized === 'on-site' || normalized === 'onsite') return 'onsite'
  return 'unspecified'
}

function legacyPriority(value: unknown): JobDraft['priority'] {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isPriority(normalized) ? normalized : 'medium'
}

function JobBadges({ job }: { job: Job }) {
  return (
    <div className="badges">
      <span className={`status status-${job.status}`}>{STATUS_LABELS[job.status]}</span>
      <span className={`priority priority-${job.priority}`}>{job.priority}</span>
      {job.work_mode !== 'unspecified' && <span className="tag">{job.work_mode}</span>}
    </div>
  )
}

type WorkspaceProps = { session: Session }

export function Workspace({ session }: WorkspaceProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [cvs, setCVs] = useState<CV[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [settingsPersisted, setSettingsPersisted] = useState(false)
  const [view, setView] = useState<AppView>('dashboard')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | JobStatus>('all')
  const [editing, setEditing] = useState<Job | 'new' | null>(null)
  const [editingCV, setEditingCV] = useState<CV | 'new' | null>(null)
  const initialViewSet = useRef(false)

  const loadWorkspace = useCallback(async () => {
    const [jobsResult, cvsResult, settingsResult] = await Promise.all([
      supabase.from('jobs').select('*').order('updated_at', { ascending: false }),
      supabase.from('cvs').select('*').order('updated_at', { ascending: false }),
      supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
    ])

    if (jobsResult.error) setError(jobsResult.error.message)
    else setJobs((jobsResult.data ?? []) as Job[])

    if (cvsResult.error) setError(cvsResult.error.message)
    else setCVs((cvsResult.data ?? []) as CV[])

    if (settingsResult.error) {
      setError(settingsResult.error.message)
      setSettings(defaultSettings(session.user.id))
      setSettingsPersisted(false)
    }
    else {
      const nextSettings = settingsResult.data as UserSettings | null
      setSettings(nextSettings ?? defaultSettings(session.user.id))
      setSettingsPersisted(Boolean(nextSettings))
      if (!initialViewSet.current) {
        setView(nextSettings?.default_view ?? 'dashboard')
        initialViewSet.current = true
      }
    }
    setLoading(false)
  }, [session.user.id])

  useEffect(() => {
    void loadWorkspace()
    const channel = supabase
      .channel(`opportunity-desk-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `user_id=eq.${session.user.id}` }, () => void loadWorkspace())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cvs', filter: `user_id=eq.${session.user.id}` }, () => void loadWorkspace())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${session.user.id}` }, () => void loadWorkspace())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadWorkspace, session.user.id])

  useEffect(() => {
    if (!settings?.reminders_enabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const reminderLeadMilliseconds = settings.reminder_lead_hours * 3_600_000

    function showDueNotifications() {
      const now = Date.now()
      jobs.forEach((job) => {
        if (!job.next_action_at || !ACTIVE_STATUSES.includes(job.status)) return
        const dueAt = new Date(job.next_action_at).getTime()
        if (dueAt > now + reminderLeadMilliseconds || dueAt < now - 7 * 86_400_000) return
        const notificationKey = `opportunity-desk-notified:${job.id}:${job.next_action_at}`
        if (localStorage.getItem(notificationKey)) return
        new Notification(job.next_action || 'Application follow-up', {
          body: `${job.role_title} at ${job.company} · ${relativeDueLabel(job.next_action_at)}`,
        })
        localStorage.setItem(notificationKey, '1')
      })
    }

    showDueNotifications()
    const timer = window.setInterval(showDueNotifications, 60_000)
    return () => window.clearInterval(timer)
  }, [jobs, settings])

  const visibleJobs = useMemo(() => jobs.filter((job) => jobMatches(job, search, filter)), [filter, jobs, search])
  const reminders = useMemo(() => jobs
    .filter((job) => job.next_action_at && ACTIVE_STATUSES.includes(job.status))
    .sort((left, right) => new Date(left.next_action_at!).getTime() - new Date(right.next_action_at!).getTime()), [jobs])

  const counts = useMemo(() => ({
    active: jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)).length,
    interviews: jobs.filter((job) => ['phone_screen', 'interviewing', 'assessment', 'final_round'].includes(job.status)).length,
    offers: jobs.filter((job) => job.status === 'offer').length,
    followUps: reminders.filter((job) => new Date(job.next_action_at!).getTime() <= Date.now() + 7 * 86_400_000).length,
  }), [jobs, reminders])

  async function saveJob(draft: JobDraft) {
    if (!editing) return
    const recordBeingEdited = editing
    setBusy(true)
    setError('')
    setNotice('')
    const payload = draftToPayload(draft)
    const result = recordBeingEdited === 'new'
      ? await supabase.from('jobs').insert({ ...payload, user_id: session.user.id }).select('id, version').maybeSingle()
      : await supabase.from('jobs').update(payload).eq('id', recordBeingEdited.id).eq('version', recordBeingEdited.version).select('id, version').maybeSingle()

    if (result.error) setError(result.error.message)
    else if (!result.data && recordBeingEdited !== 'new') {
      const { data: latest, error: latestError } = await supabase.from('jobs').select('version').eq('id', recordBeingEdited.id).maybeSingle()
      if (latestError) setError(latestError.message)
      else if (!latest) setError('This application was deleted on another device. Your unsaved edits remain open.')
      else {
        setEditing({ ...recordBeingEdited, version: latest.version })
        setError('This application changed on another device. Your edits remain open. Review them, then save again.')
      }
      await loadWorkspace()
    } else {
      setEditing(null)
      setNotice('Application saved and synchronized.')
      await loadWorkspace()
    }
    setBusy(false)
  }

  async function changeStatus(job: Job, status: JobStatus) {
    if (status === job.status) return
    setBusy(true)
    setError('')
    const { data, error: updateError } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', job.id)
      .eq('version', job.version)
      .select('id')
      .maybeSingle()
    if (updateError) setError(updateError.message)
    else if (!data) setError('This application changed on another device. The latest version has been loaded; please try the move again.')
    await loadWorkspace()
    setBusy(false)
  }

  async function deleteJob(job: Job) {
    if (!window.confirm(`Delete ${job.role_title} at ${job.company}? This cannot be undone.`)) return
    setBusy(true)
    const { error: deleteError } = await supabase.from('jobs').delete().eq('id', job.id)
    if (deleteError) setError(deleteError.message)
    else {
      setNotice('Application deleted.')
      await loadWorkspace()
    }
    setBusy(false)
  }

  async function saveSettings(draft: SettingsDraft) {
    setBusy(true)
    setError('')
    const basePayload = { ...draft, user_id: session.user.id }
    const result = settingsPersisted && settings
      ? await supabase.from('user_settings').update(draft).eq('user_id', session.user.id).eq('version', settings.version).select('*').maybeSingle()
      : await supabase.from('user_settings').upsert(basePayload, { onConflict: 'user_id' }).select('*').maybeSingle()

    if (result.error) setError(result.error.message)
    else if (!result.data) setError('Your settings changed on another device. The latest version has been loaded; review it and save again.')
    else {
      setSettings(result.data as UserSettings)
      setSettingsPersisted(true)
      setNotice('Settings saved and synchronized.')
    }
    await loadWorkspace()
    setBusy(false)
  }

  function exportJson() {
    const backup = { opportunityDeskVersion: 1, exportedAt: new Date().toISOString(), jobs }
    downloadText(`opportunity-desk-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json')
  }

  function exportCsv() {
    downloadText(`opportunity-desk-${new Date().toISOString().slice(0, 10)}.csv`, jobsToCsv(jobs), 'text/csv;charset=utf-8')
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const parsed = JSON.parse(await file.text()) as { opportunityDeskVersion?: unknown; jobs?: unknown }
      if (!Array.isArray(parsed.jobs) || (parsed.opportunityDeskVersion !== undefined && parsed.opportunityDeskVersion !== 1)) {
        throw new Error('This is not a recognized Opportunity Desk backup.')
      }
      if (parsed.jobs.length > 1000) throw new Error('This backup is too large to import safely in one step.')
      const isLegacyBackup = parsed.opportunityDeskVersion === undefined
      const importDescription = isLegacyBackup ? 'The older backup will be converted and added as new synchronized records.' : 'Matching records will be updated.'
      if (!window.confirm(`Import ${parsed.jobs.length} applications? ${importDescription}`)) return

      const rows = parsed.jobs.map((candidate) => {
        if (!candidate || typeof candidate !== 'object') throw new Error('The backup contains an invalid application.')
        if (isLegacyBackup) {
          const legacy = candidate as Record<string, unknown>
          if (typeof legacy.company !== 'string' || !legacy.company.trim()) throw new Error('The older backup contains an application without a company.')
          const legacyDraft: JobDraft = {
            ...EMPTY_JOB,
            company: legacy.company,
            role_title: typeof legacy.role === 'string' && legacy.role.trim() ? legacy.role : 'Role not specified',
            status: legacyStatus(legacy.status),
            priority: legacyPriority(legacy.priority),
            work_mode: legacyWorkMode(legacy.mode),
            location: typeof legacy.location === 'string' ? legacy.location : '',
            job_url: typeof legacy.url === 'string' ? legacy.url : '',
            source: typeof legacy.source === 'string' ? legacy.source : '',
            salary_text: typeof legacy.salary === 'string' ? legacy.salary : '',
            contact_name: typeof legacy.contact === 'string' ? legacy.contact : '',
            contact_email: typeof legacy.email === 'string' ? legacy.email : '',
            applied_at: typeof legacy.applied === 'string' ? legacy.applied : '',
            next_action: typeof legacy.next === 'string' ? legacy.next : '',
            next_action_at: typeof legacy.nextDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(legacy.nextDate) ? `${legacy.nextDate}T09:00` : '',
            job_description: typeof legacy.jobDesc === 'string' ? legacy.jobDesc : '',
            notes: typeof legacy.notes === 'string' ? legacy.notes : '',
            email_recipient: typeof legacy.sendto === 'string' ? legacy.sendto : (typeof legacy.email === 'string' ? legacy.email : ''),
            email_subject: typeof legacy.emailSubject === 'string' ? legacy.emailSubject : '',
            email_body: typeof legacy.emailBody === 'string' ? legacy.emailBody : '',
          }
          return { user_id: session.user.id, ...draftToPayload(legacyDraft) }
        }

        const job = candidate as Partial<Job>
        if (!job.id || !job.company || !job.role_title || !isJobStatus(job.status) || !isPriority(job.priority) || !isWorkMode(job.work_mode)) throw new Error('The backup contains an incomplete application.')
        return {
          id: job.id,
          user_id: session.user.id,
          ...draftToPayload({
            ...EMPTY_JOB,
            company: job.company,
            role_title: job.role_title,
            status: job.status,
            priority: job.priority,
            work_mode: job.work_mode,
            location: job.location ?? '',
            job_url: job.job_url ?? '',
            source: job.source ?? '',
            salary_text: job.salary_text ?? '',
            contact_name: job.contact_name ?? '',
            contact_email: job.contact_email ?? '',
            applied_at: job.applied_at ?? '',
            next_action: job.next_action ?? '',
            next_action_at: toLocalDateTimeInput(job.next_action_at ?? null),
            job_description: job.job_description ?? '',
            notes: job.notes ?? '',
            external_job_id: job.external_job_id ?? '',
            email_recipient: job.email_recipient ?? '',
            email_subject: job.email_subject ?? '',
            email_body: job.email_body ?? '',
          }),
          data: job.data ?? {},
        }
      })

      const importQuery = isLegacyBackup
        ? supabase.from('jobs').insert(rows)
        : supabase.from('jobs').upsert(rows, { onConflict: 'id' })
      const { error: importError } = await importQuery
      if (importError) throw importError
      setNotice(`${rows.length} applications imported and synchronized.`)
      await loadWorkspace()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The backup could not be imported.')
    } finally {
      setBusy(false)
    }
  }

  async function saveCV(draft: CVDraft, file: File | null) {
    if (!editingCV) return
    const recordBeingEdited = editingCV
    const cvId = recordBeingEdited === 'new' ? crypto.randomUUID() : recordBeingEdited.id
    let uploadedPath: string | null = null
    setBusy(true)
    setError('')
    setNotice('')

    try {
      let plainText = draft.plain_text.trim() || null
      let filePayload: Pick<CV, 'storage_path' | 'original_filename' | 'mime_type' | 'size_bytes'> | Record<string, never> = {}

      if (file) {
        const { extension, mimeType } = validateCVFile(file)
        if (extension === 'txt' && !plainText) plainText = (await file.text()).trim() || null
        uploadedPath = `${session.user.id}/${cvId}/${Date.now()}-${safeStorageFilename(file.name)}`
        const { error: uploadError } = await supabase.storage.from('cvs').upload(uploadedPath, file, {
          cacheControl: '3600',
          contentType: mimeType,
          upsert: false,
        })
        if (uploadError) throw uploadError
        filePayload = {
          storage_path: uploadedPath,
          original_filename: file.name,
          mime_type: mimeType,
          size_bytes: file.size,
        }
      }

      const payload = {
        name: draft.name.trim(),
        target_role: draft.target_role.trim() || null,
        notes: draft.notes.trim() || null,
        plain_text: plainText,
        ...filePayload,
      }
      const result = recordBeingEdited === 'new'
        ? await supabase.from('cvs').insert({ id: cvId, user_id: session.user.id, data: {}, ...payload }).select('id, version').maybeSingle()
        : await supabase.from('cvs').update(payload).eq('id', recordBeingEdited.id).eq('version', recordBeingEdited.version).select('id, version').maybeSingle()

      if (result.error) throw result.error
      if (!result.data && recordBeingEdited !== 'new') {
        if (uploadedPath) {
          await supabase.storage.from('cvs').remove([uploadedPath])
          uploadedPath = null
        }
        const { data: latest, error: latestError } = await supabase.from('cvs').select('version').eq('id', recordBeingEdited.id).maybeSingle()
        if (latestError) throw latestError
        if (!latest) setError('This CV was deleted on another device. Your unsaved edits remain open.')
        else {
          setEditingCV({ ...recordBeingEdited, version: latest.version })
          setError('This CV changed on another device. Your edits remain open. Review them, then save again.')
        }
        await loadWorkspace()
        return
      }

      let cleanupWarning = ''
      if (recordBeingEdited !== 'new' && uploadedPath && recordBeingEdited.storage_path && recordBeingEdited.storage_path !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('cvs').remove([recordBeingEdited.storage_path])
        if (cleanupError) cleanupWarning = ' The older file could not be removed automatically.'
      }
      uploadedPath = null
      setEditingCV(null)
      setNotice(`CV saved and synchronized.${cleanupWarning}`)
      await loadWorkspace()
    } catch (caught) {
      if (uploadedPath) await supabase.storage.from('cvs').remove([uploadedPath])
      setError(caught instanceof Error ? caught.message : 'The CV could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadCV(cv: CV) {
    if (!cv.storage_path) {
      setError('This is a text-only CV and has no file to download.')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: downloadError } = await supabase.storage.from('cvs').download(cv.storage_path)
    if (downloadError) setError(downloadError.message)
    else {
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = cv.original_filename || `${safeStorageFilename(cv.name)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('CV download started.')
    }
    setBusy(false)
  }

  async function deleteCV(cv: CV) {
    if (!window.confirm(`Delete ${cv.name}? This removes its saved file and cannot be undone.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    const { data, error: deleteError } = await supabase.from('cvs').delete().eq('id', cv.id).eq('version', cv.version).select('id').maybeSingle()
    if (deleteError) setError(deleteError.message)
    else if (!data) setError('This CV changed or was deleted on another device. The latest library has been loaded; please review it and try again.')
    else {
      let cleanupWarning = ''
      if (cv.storage_path) {
        const { error: cleanupError } = await supabase.storage.from('cvs').remove([cv.storage_path])
        if (cleanupError) cleanupWarning = ' Its database record was deleted, but the stored file could not be cleaned up automatically.'
      }
      setNotice(`CV deleted.${cleanupWarning}`)
    }
    await loadWorkspace()
    setBusy(false)
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setError('This browser does not support desktop notifications.')
      return
    }
    const permission = await Notification.requestPermission()
    setNotice(permission === 'granted' ? 'Browser reminders are enabled on this device.' : 'Notification permission was not granted.')
  }

  const openEditor = (job: Job) => { setError(''); setEditing(job) }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark small">EZ</span><div><strong>Opportunity Desk</strong><span>Career workspace</span></div></div>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.view} className={view === item.view ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.view)}>
              <span aria-hidden="true">{item.symbol}</span>{item.label}
              {item.view === 'search' && <small>next</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-account"><span>{session.user.email}</span><button className="button ghost" onClick={() => void supabase.auth.signOut()}>Sign out</button></div>
      </aside>

      <div className="workspace-shell">
        <header className="mobile-topbar"><strong>Opportunity Desk</strong><button className="button ghost" onClick={() => void supabase.auth.signOut()}>Sign out</button></header>
        <div className="mobile-nav" aria-label="Mobile navigation">{NAV_ITEMS.map((item) => <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => setView(item.view)}>{item.label}</button>)}</div>
        <main className="dashboard">
          <section className="page-head">
            <div><p className="eyebrow">Private synchronized workspace</p><h1>{viewTitle(view)}</h1></div>
            <button className="button primary add-button" onClick={() => { setError(''); if (view === 'cvs') setEditingCV('new'); else setEditing('new') }}>{view === 'cvs' ? '+ Add CV' : '+ Add application'}</button>
          </section>

          {error && <div className="error-banner" role="alert">{error}</div>}
          {notice && <div className="notice-banner" role="status">{notice}</div>}
          {loading ? <div className="workspace-card empty-state">Loading your workspace…</div> : (
            <>
              {view === 'dashboard' && <DashboardView jobs={jobs} counts={counts} reminders={reminders} onEdit={openEditor} onViewAll={() => setView('applications')} />}
              {view === 'board' && <BoardView jobs={jobs} busy={busy} onEdit={openEditor} onStatus={changeStatus} />}
              {view === 'applications' && <ApplicationsView jobs={visibleJobs} total={jobs.length} search={search} filter={filter} busy={busy} onSearch={setSearch} onFilter={setFilter} onEdit={openEditor} onDelete={deleteJob} />}
              {view === 'reminders' && <RemindersView jobs={reminders} onEdit={openEditor} onEnable={enableNotifications} />}
              {view === 'backup' && <BackupView jobs={jobs} busy={busy} onJson={exportJson} onCsv={exportCsv} onImport={importJson} />}
              {view === 'settings' && settings && <SettingsView settings={settings} busy={busy} onSave={saveSettings} onEnableNotifications={enableNotifications} />}
              {view === 'cvs' && <CVLibrary cvs={cvs} busy={busy} onAdd={() => { setError(''); setEditingCV('new') }} onEdit={(cv) => { setError(''); setEditingCV(cv) }} onDownload={downloadCV} onDelete={deleteCV} />}
              {view === 'search' && <NextPhaseView title="Find jobs" message="Live job search will be added after the core tracker is verified. Public feeds will stay in the browser; private API keys will stay in Supabase." />}
            </>
          )}
        </main>
      </div>

      {editing && <JobForm initial={editing === 'new' ? EMPTY_JOB : toDraft(editing)} title={editing === 'new' ? 'Add an opportunity' : 'Update application'} busy={busy} error={error} onCancel={() => { setError(''); setEditing(null) }} onSave={saveJob} />}
      {editingCV && <CVForm initial={editingCV === 'new' ? EMPTY_CV : cvToDraft(editingCV)} title={editingCV === 'new' ? 'Add a CV' : 'Update CV'} existingFilename={editingCV === 'new' ? null : editingCV.original_filename || (editingCV.storage_path ? 'Stored file' : null)} busy={busy} error={error} onCancel={() => { setError(''); setEditingCV(null) }} onSave={saveCV} />}
    </div>
  )
}

function DashboardView({ jobs, counts, reminders, onEdit, onViewAll }: { jobs: Job[]; counts: { active: number; interviews: number; offers: number; followUps: number }; reminders: Job[]; onEdit: (job: Job) => void; onViewAll: () => void }) {
  const maximum = Math.max(1, ...JOB_STATUSES.map((status) => jobs.filter((job) => job.status === status).length))
  return (
    <>
      <section className="metrics" aria-label="Application summary">
        <article><span>Active pipeline</span><strong>{counts.active}</strong></article>
        <article><span>Interview stages</span><strong>{counts.interviews}</strong></article>
        <article><span>Offers</span><strong>{counts.offers}</strong></article>
        <article><span>Actions this week</span><strong>{counts.followUps}</strong></article>
      </section>
      <div className="dashboard-grid">
        <section className="workspace-card panel">
          <div className="panel-head"><div><p className="eyebrow">Pipeline</p><h2>Stage overview</h2></div><button className="button ghost" onClick={onViewAll}>View all</button></div>
          <div className="pipeline-chart">{JOB_STATUSES.filter((status) => jobs.some((job) => job.status === status)).map((status) => { const count = jobs.filter((job) => job.status === status).length; return <div className="pipeline-row" key={status}><span>{STATUS_LABELS[status]}</span><div><i style={{ width: `${(count / maximum) * 100}%` }} /></div><strong>{count}</strong></div> })}{jobs.length === 0 && <div className="compact-empty">Add an application to see your pipeline.</div>}</div>
        </section>
        <section className="workspace-card panel">
          <div className="panel-head"><div><p className="eyebrow">Needs attention</p><h2>Next actions</h2></div></div>
          <div className="attention-list">{reminders.slice(0, 5).map((job) => <button key={job.id} onClick={() => onEdit(job)}><span><strong>{job.next_action || 'Follow up'}</strong><small>{job.role_title} · {job.company}</small></span><em className={new Date(job.next_action_at!).getTime() < Date.now() ? 'overdue' : ''}>{relativeDueLabel(job.next_action_at!)}</em></button>)}{reminders.length === 0 && <div className="compact-empty">No follow-ups are scheduled.</div>}</div>
        </section>
      </div>
    </>
  )
}

function BoardView({ jobs, busy, onEdit, onStatus }: { jobs: Job[]; busy: boolean; onEdit: (job: Job) => void; onStatus: (job: Job, status: JobStatus) => Promise<void> }) {
  return <section className="kanban" aria-label="Application board">{BOARD_COLUMNS.map((column) => { const columnJobs = jobs.filter((job) => column.statuses.includes(job.status)); return <div className="kanban-column" key={column.title}><div className="kanban-head"><strong>{column.title}</strong><span>{columnJobs.length}</span></div><div className="kanban-cards">{columnJobs.map((job) => <article className="kanban-card" key={job.id}><JobBadges job={job} /><button className="card-title" onClick={() => onEdit(job)}><strong>{job.role_title}</strong><span>{job.company}</span></button>{job.next_action_at && <small>{job.next_action || 'Next action'} · {relativeDueLabel(job.next_action_at)}</small>}<label className="compact-select">Move to<select disabled={busy} value={job.status} onChange={(event) => void onStatus(job, event.target.value as JobStatus)}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label></article>)}{columnJobs.length === 0 && <div className="column-empty">No applications</div>}</div></div> })}</section>
}

function ApplicationsView({ jobs, total, search, filter, busy, onSearch, onFilter, onEdit, onDelete }: { jobs: Job[]; total: number; search: string; filter: 'all' | JobStatus; busy: boolean; onSearch: (value: string) => void; onFilter: (value: 'all' | JobStatus) => void; onEdit: (job: Job) => void; onDelete: (job: Job) => Promise<void> }) {
  return <section className="workspace-card"><div className="workspace-head"><div><p className="eyebrow">Your pipeline</p><h2>{total} applications</h2></div><div className="controls"><input aria-label="Search applications" placeholder="Search company, role or notes" value={search} onChange={(event) => onSearch(event.target.value)} /><select aria-label="Filter by status" value={filter} onChange={(event) => onFilter(event.target.value as 'all' | JobStatus)}><option value="all">All statuses</option>{JOB_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></div></div>{jobs.length === 0 ? <div className="empty-state"><strong>{total ? 'No matching applications' : 'Your pipeline is ready'}</strong><span>{total ? 'Try a different search or status.' : 'Add your first opportunity to start tracking it across devices.'}</span></div> : <div className="table-wrap"><table><thead><tr><th>Opportunity</th><th>Stage</th><th>Follow-up</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><strong>{job.role_title}</strong><span>{job.company}{job.location ? ` · ${job.location}` : ''}</span></td><td><JobBadges job={job} /></td><td>{job.next_action_at ? <><strong>{job.next_action || 'Follow up'}</strong><span>{formatDateTime(job.next_action_at)}</span></> : <span>Not scheduled</span>}</td><td>{formatDateTime(job.updated_at)}</td><td><div className="row-actions">{job.job_url && <a className="button ghost" href={job.job_url} target="_blank" rel="noreferrer">Open</a>}<button className="button secondary" onClick={() => onEdit(job)}>Edit</button><button className="button danger" disabled={busy} onClick={() => void onDelete(job)}>Delete</button></div></td></tr>)}</tbody></table></div>}</section>
}

function RemindersView({ jobs, onEdit, onEnable }: { jobs: Job[]; onEdit: (job: Job) => void; onEnable: () => Promise<void> }) {
  return <section className="workspace-card"><div className="workspace-head"><div><p className="eyebrow">Follow-up queue</p><h2>{jobs.length} scheduled actions</h2></div><button className="button secondary" onClick={() => void onEnable()}>Enable browser alerts</button></div>{jobs.length === 0 ? <div className="empty-state"><strong>Nothing is due</strong><span>Add a next action and date to an application to see it here.</span></div> : <div className="reminder-list">{jobs.map((job) => <button key={job.id} onClick={() => onEdit(job)}><time dateTime={job.next_action_at!}>{formatDateTime(job.next_action_at!)}</time><span><strong>{job.next_action || 'Follow up'}</strong><small>{job.role_title} at {job.company}</small></span><em className={new Date(job.next_action_at!).getTime() < Date.now() ? 'overdue' : ''}>{relativeDueLabel(job.next_action_at!)}</em></button>)}</div>}</section>
}

function CVLibrary({ cvs, busy, onAdd, onEdit, onDownload, onDelete }: { cvs: CV[]; busy: boolean; onAdd: () => void; onEdit: (cv: CV) => void; onDownload: (cv: CV) => Promise<void>; onDelete: (cv: CV) => Promise<void> }) {
  const [search, setSearch] = useState('')
  const filteredCVs = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return cvs
    return cvs.filter((cv) => [cv.name, cv.target_role ?? '', cv.notes ?? '', cv.plain_text ?? ''].some((value) => value.toLowerCase().includes(needle)))
  }, [cvs, search])

  return (
    <section className="workspace-card">
      <div className="workspace-head"><div><p className="eyebrow">Secure document workspace</p><h2>{cvs.length} CV versions</h2></div><div className="controls"><input aria-label="Search CVs" placeholder="Search name, role, notes, or text" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      {filteredCVs.length === 0 ? <div className="empty-state"><strong>{cvs.length ? 'No matching CVs' : 'Build your CV library'}</strong><span>{cvs.length ? 'Try a different search.' : 'Upload a document, paste a text version, or use both. Your private library will follow your account to every device.'}</span>{!cvs.length && <button className="button primary" onClick={onAdd}>Add your first CV</button>}</div> : (
        <div className="cv-grid">{filteredCVs.map((cv) => (
          <article className="cv-card" key={cv.id}>
            <div className="cv-card-head"><span className="cv-file-mark" aria-hidden="true">CV</span><div><h3>{cv.name}</h3><p>{cv.target_role || 'General CV'}</p></div></div>
            <div className="cv-meta"><span>{cv.storage_path ? cv.original_filename || 'Stored file' : 'Text-only version'}</span>{cv.size_bytes != null && <span>{formatFileSize(cv.size_bytes)}</span>}<span>Updated {formatDateTime(cv.updated_at)}</span></div>
            {cv.notes && <p className="cv-notes">{cv.notes}</p>}
            {cv.plain_text && <p className="cv-preview">{cv.plain_text.slice(0, 180)}{cv.plain_text.length > 180 ? '…' : ''}</p>}
            <div className="cv-actions">{cv.storage_path && <button className="button secondary" disabled={busy} onClick={() => void onDownload(cv)}>Download</button>}<button className="button secondary" disabled={busy} onClick={() => onEdit(cv)}>Edit</button><button className="button danger" disabled={busy} onClick={() => void onDelete(cv)}>Delete</button></div>
          </article>
        ))}</div>
      )}
    </section>
  )
}

function BackupView({ jobs, busy, onJson, onCsv, onImport }: { jobs: Job[]; busy: boolean; onJson: () => void; onCsv: () => void; onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void> }) {
  return <div className="settings-grid"><section className="workspace-card panel"><p className="eyebrow">Portable application copy</p><h2>Export applications</h2><p>Download application records as a restorable JSON file or a CSV spreadsheet. CV files remain protected in the separate private library.</p><div className="button-row"><button className="button primary" onClick={onJson}>Download JSON backup</button><button className="button secondary" onClick={onCsv}>Download CSV</button></div></section><section className="workspace-card panel"><p className="eyebrow">Restore applications</p><h2>Import a backup</h2><p>Import a JSON file created by this version of Opportunity Desk. Matching application IDs are updated; new ones are added.</p><label className={busy ? 'button secondary file-button disabled' : 'button secondary file-button'}>{busy ? 'Importing…' : 'Choose JSON backup'}<input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => void onImport(event)} /></label><small>{jobs.length} applications are currently synchronized.</small></section></div>
}

function SettingsView({ settings, busy, onSave, onEnableNotifications }: { settings: UserSettings; busy: boolean; onSave: (draft: SettingsDraft) => Promise<void>; onEnableNotifications: () => Promise<void> }) {
  const [draft, setDraft] = useState<SettingsDraft>({ default_view: settings.default_view, reminders_enabled: settings.reminders_enabled, reminder_lead_hours: settings.reminder_lead_hours, timezone: settings.timezone })
  useEffect(() => setDraft({ default_view: settings.default_view, reminders_enabled: settings.reminders_enabled, reminder_lead_hours: settings.reminder_lead_hours, timezone: settings.timezone }), [settings])
  return <section className="workspace-card settings-form"><div><p className="eyebrow">Synchronized preferences</p><h2>Workspace settings</h2><p>These preferences follow your account to every device. Browser notification permission is still controlled separately by each device.</p></div><label>Start page<select value={draft.default_view} onChange={(event) => setDraft({ ...draft, default_view: event.target.value as DefaultView })}>{APP_VIEWS.filter((candidate): candidate is DefaultView => ['dashboard', 'board', 'applications', 'reminders', 'cvs'].includes(candidate)).map((candidate) => <option value={candidate} key={candidate}>{viewTitle(candidate)}</option>)}</select></label><label>Timezone<input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></label><label>Reminder lead time<select value={draft.reminder_lead_hours} onChange={(event) => setDraft({ ...draft, reminder_lead_hours: Number(event.target.value) })}><option value={0}>At the due time</option><option value={1}>1 hour before</option><option value={6}>6 hours before</option><option value={24}>1 day before</option><option value={72}>3 days before</option><option value={168}>1 week before</option></select></label><label className="check-label"><input type="checkbox" checked={draft.reminders_enabled} onChange={(event) => setDraft({ ...draft, reminders_enabled: event.target.checked })} />Show reminders while Opportunity Desk is open</label><div className="button-row"><button className="button primary" disabled={busy} onClick={() => void onSave(draft)}>{busy ? 'Saving…' : 'Save settings'}</button><button className="button secondary" onClick={() => void onEnableNotifications()}>Allow browser notifications</button></div></section>
}

function NextPhaseView({ title, message }: { title: string; message: string }) {
  return <section className="workspace-card empty-state next-phase"><span className="phase-pill">Prepared for phase 2</span><strong>{title}</strong><span>{message}</span></section>
}
