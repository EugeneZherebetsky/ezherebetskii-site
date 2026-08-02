import { useState } from 'react'
import { JOB_STATUSES, PRIORITIES, STATUS_LABELS, WORK_MODES, type CV, type JobDraft, type JobPriority, type JobStatus, type WorkMode } from '../types'

type JobFormProps = {
  initial: JobDraft
  title: string
  busy: boolean
  error: string
  cvs: CV[]
  onCancel: () => void
  onSave: (draft: JobDraft) => Promise<void>
}

export function JobForm({ initial, title, busy, error, cvs, onCancel, onSave }: JobFormProps) {
  const [draft, setDraft] = useState<JobDraft>(initial)

  function field<K extends keyof JobDraft>(key: K, value: JobDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="job-form-title">
        <div className="modal-header">
          <div><p className="eyebrow">Application record</p><h2 id="job-form-title">{title}</h2></div>
          <button className="icon-button" onClick={onCancel} aria-label="Close form">×</button>
        </div>
        <form className="job-form" onSubmit={(event) => { event.preventDefault(); void onSave(draft) }}>
          <h3 className="form-section-title full">Opportunity</h3>
          <label>Company<input value={draft.company} onChange={(event) => field('company', event.target.value)} required /></label>
          <label>Role title<input value={draft.role_title} onChange={(event) => field('role_title', event.target.value)} required /></label>
          <label>Status<select value={draft.status} onChange={(event) => field('status', event.target.value as JobStatus)}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
          <label>Priority<select value={draft.priority} onChange={(event) => field('priority', event.target.value as JobPriority)}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
          <label>Work style<select value={draft.work_mode} onChange={(event) => field('work_mode', event.target.value as WorkMode)}>{WORK_MODES.map((mode) => <option key={mode} value={mode}>{mode === 'unspecified' ? 'Not specified' : mode[0].toUpperCase() + mode.slice(1)}</option>)}</select></label>
          <label>Location<input value={draft.location} onChange={(event) => field('location', event.target.value)} /></label>
          <label>Job link<input type="url" value={draft.job_url} onChange={(event) => field('job_url', event.target.value)} placeholder="https://" /></label>
          <label>Source<input value={draft.source} onChange={(event) => field('source', event.target.value)} placeholder="LinkedIn, recruiter…" /></label>
          <label>CV used<select value={draft.cv_id} onChange={(event) => field('cv_id', event.target.value)}><option value="">No CV linked</option>{cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.name}{cv.tailored_company ? ` — ${cv.tailored_company}` : ''}</option>)}</select></label>
          <label>Salary / package<input value={draft.salary_text} onChange={(event) => field('salary_text', event.target.value)} /></label>
          <label>Source reference<input value={draft.external_job_id} onChange={(event) => field('external_job_id', event.target.value)} placeholder="Optional job ID" /></label>
          <label className="full">Job description<textarea rows={6} value={draft.job_description} onChange={(event) => field('job_description', event.target.value)} /></label>

          <h3 className="form-section-title full">Progress and follow-up</h3>
          <label>Applied date<input type="date" value={draft.applied_at} onChange={(event) => field('applied_at', event.target.value)} /></label>
          <label>Next action<input value={draft.next_action} onChange={(event) => field('next_action', event.target.value)} placeholder="Follow up, prepare interview…" /></label>
          <label>Next action date and time<input type="datetime-local" value={draft.next_action_at} onChange={(event) => field('next_action_at', event.target.value)} /></label>
          <label>Contact name<input value={draft.contact_name} onChange={(event) => field('contact_name', event.target.value)} /></label>
          <label>Contact email<input type="email" value={draft.contact_email} onChange={(event) => field('contact_email', event.target.value)} /></label>
          <label className="full">Notes<textarea rows={5} value={draft.notes} onChange={(event) => field('notes', event.target.value)} /></label>

          <h3 className="form-section-title full">Email draft</h3>
          <label>Email recipient<input type="email" value={draft.email_recipient} onChange={(event) => field('email_recipient', event.target.value)} /></label>
          <label>Email subject<input value={draft.email_subject} onChange={(event) => field('email_subject', event.target.value)} /></label>
          <label className="full">Email message<textarea rows={6} value={draft.email_body} onChange={(event) => field('email_body', event.target.value)} /></label>

          {error && <p className="form-message error-text full" role="alert">{error}</p>}
          <div className="form-actions full">
            <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>
            <button className="button primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save application'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
