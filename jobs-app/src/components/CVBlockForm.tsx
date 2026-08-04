import { useState } from 'react'
import { CV_BLOCK_TYPES, CV_BLOCK_TYPE_LABELS, type CVBlockDraft, type CVBlockType } from '../types'

type CVBlockFormProps = {
  initial: CVBlockDraft
  title: string
  busy: boolean
  error: string
  onCancel: () => void
  onSave: (draft: CVBlockDraft) => Promise<void>
}

const CONTENT_HINTS: Record<CVBlockType, string> = {
  summary: 'Two or three sentences describing what you do and at what level.',
  skills: 'A comma-separated list, or short grouped lines such as “Cloud: AWS, Azure”.',
  experience: 'A role entry: employer, title, dates, and what the role covered.',
  achievement: 'One outcome, written as you would want it read on a CV.',
  education: 'Institution, qualification, and year.',
  certification: 'Certification name, issuer, and year.',
  other: 'Anything else you reuse: languages, publications, security clearance.',
}

export function CVBlockForm({ initial, title, busy, error, onCancel, onSave }: CVBlockFormProps) {
  const [draft, setDraft] = useState<CVBlockDraft>(initial)

  function field<K extends keyof CVBlockDraft>(key: K, value: CVBlockDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="cv-block-title">
        <header className="modal-header">
          <div><p className="eyebrow">Reusable CV content</p><h2 id="cv-block-title">{title}</h2></div>
          <button className="icon-button" type="button" aria-label="Close" disabled={busy} onClick={onCancel}>×</button>
        </header>
        <form className="job-form" onSubmit={(event) => { event.preventDefault(); void onSave(draft) }}>
          <label>Block type<select value={draft.block_type} onChange={(event) => field('block_type', event.target.value as CVBlockType)}>{CV_BLOCK_TYPES.map((type) => <option key={type} value={type}>{CV_BLOCK_TYPE_LABELS[type]}</option>)}</select></label>
          <label>Label<input required autoFocus value={draft.title} placeholder="Platform engineering skills" onChange={(event) => field('title', event.target.value)} /><small>Only you see this; it identifies the block in the builder.</small></label>
          <label className="full">Content<textarea required rows={6} value={draft.content} placeholder={CONTENT_HINTS[draft.block_type]} onChange={(event) => field('content', event.target.value)} /><small>{CONTENT_HINTS[draft.block_type]} This text is used exactly as written when the CV is assembled.</small></label>
          <label>Tags<input value={draft.tags} placeholder="cloud, leadership, manufacturing" onChange={(event) => field('tags', event.target.value)} /><small>Extra words to help this block match a role description.</small></label>
          <label>Order<input type="number" value={draft.sort_order} onChange={(event) => field('sort_order', Number(event.target.value))} /><small>Lower numbers appear first within their section.</small></label>
          {error && <p className="form-message error-text full" role="alert">{error}</p>}
          <div className="form-actions full">
            <button className="button secondary" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
            <button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save block'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
