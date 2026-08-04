import { useState } from 'react'
import type { StarStoryDraft } from '../types'

type StarStoryFormProps = {
  initial: StarStoryDraft
  title: string
  busy: boolean
  error: string
  onCancel: () => void
  onSave: (draft: StarStoryDraft) => Promise<void>
}

export function StarStoryForm({ initial, title, busy, error, onCancel, onSave }: StarStoryFormProps) {
  const [draft, setDraft] = useState<StarStoryDraft>(initial)

  function field<K extends keyof StarStoryDraft>(key: K, value: StarStoryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="star-form-title">
        <header className="modal-header">
          <div><p className="eyebrow">Interview preparation</p><h2 id="star-form-title">{title}</h2></div>
          <button className="icon-button" type="button" aria-label="Close form" disabled={busy} onClick={onCancel}>×</button>
        </header>
        <form className="job-form" onSubmit={(event) => { event.preventDefault(); void onSave(draft) }}>
          <label>Story title<input required autoFocus value={draft.title} placeholder="Rescued a failing migration" onChange={(event) => field('title', event.target.value)} /></label>
          <label>Skills it demonstrates<input value={draft.skills} placeholder="Leadership, SQL, stakeholder management" onChange={(event) => field('skills', event.target.value)} /></label>
          <label className="full">Situation<textarea rows={3} value={draft.situation} placeholder="The context: where, when, and what was at stake." onChange={(event) => field('situation', event.target.value)} /></label>
          <label className="full">Task<textarea rows={2} value={draft.task} placeholder="What you were responsible for." onChange={(event) => field('task', event.target.value)} /></label>
          <label className="full">Action<textarea rows={4} value={draft.action} placeholder="The specific steps you took." onChange={(event) => field('action', event.target.value)} /></label>
          <label className="full">Result<textarea rows={3} value={draft.result} placeholder="The measurable outcome and what you learned." onChange={(event) => field('result', event.target.value)} /></label>
          <label className="full">Notes<textarea rows={2} value={draft.notes} placeholder="When to use this story, variations for different roles…" onChange={(event) => field('notes', event.target.value)} /><small>Keep every story factual — this library is your set of verified examples.</small></label>
          {error && <p className="form-message error-text full" role="alert">{error}</p>}
          <div className="form-actions full">
            <button className="button secondary" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
            <button className="button primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save story'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
