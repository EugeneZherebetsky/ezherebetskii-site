import { useMemo, useState } from 'react'
import { copyableTailoringText, matchCV, rankCVs, tailorCV, type TailoringResult } from '../lib/tailoring'
import type { CV, Job } from '../types'

type TailorCVProps = {
  job: Job
  cvs: CV[]
  busy: boolean
  actionError: string
  actionNotice: string
  onClose: () => void
  onSaveCV: (sourceCV: CV, result: TailoringResult) => Promise<void>
  onUseCoverLetter: (result: TailoringResult) => Promise<void>
}

export function TailorCV({ job, cvs, busy, actionError, actionNotice, onClose, onSaveCV, onUseCoverLetter }: TailorCVProps) {
  const textCVs = useMemo(() => cvs.filter((cv) => Boolean(cv.plain_text?.trim())), [cvs])
  const initialCV = textCVs.find((cv) => cv.id === job.cv_id) ?? textCVs[0]
  const [cvId, setCVId] = useState(initialCV?.id ?? '')
  const [jobDescription, setJobDescription] = useState(job.job_description ?? '')
  const [result, setResult] = useState<TailoringResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectedCV = textCVs.find((cv) => cv.id === cvId)
  const match = selectedCV && jobDescription.trim() ? matchCV(selectedCV.plain_text ?? '', jobDescription) : null
  const ranking = jobDescription.trim() ? rankCVs(textCVs, jobDescription) : []
  const best = ranking[0]

  function updateResult<K extends keyof TailoringResult>(key: K, value: TailoringResult[K]) {
    setResult((current) => current ? { ...current, [key]: value } : current)
  }

  async function runAI() {
    if (!selectedCV) {
      setError('Choose a CV that has plain text first.')
      return
    }
    if (!jobDescription.trim()) {
      setError('Add the job description first.')
      return
    }
    setRunning(true)
    setError('')
    setNotice('')
    try {
      setResult(await tailorCV(job, selectedCV, jobDescription))
      setNotice('AI draft created. Review every claim before saving or sending it.')
    }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The CV could not be tailored.')
    }
    finally {
      setRunning(false)
    }
  }

  async function copyResult() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(copyableTailoringText(result))
      setNotice('Tailored draft copied to the clipboard.')
    }
    catch {
      setError('This browser could not copy the draft. Select the text manually instead.')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal tailor-modal" role="dialog" aria-modal="true" aria-labelledby="tailor-title">
        <div className="modal-header">
          <div><p className="eyebrow">CV matching and drafting</p><h2 id="tailor-title">Tailor for {job.role_title} at {job.company}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close tailoring tool">×</button>
        </div>
        <div className="tailor-body">
          <section className="tailor-inputs">
            <label>CV version<select value={cvId} onChange={(event) => { setCVId(event.target.value); setResult(null) }}><option value="">Choose a CV</option>{textCVs.map((cv) => <option key={cv.id} value={cv.id}>{cv.name}{cv.tailored_company ? ` — ${cv.tailored_company}` : ''}</option>)}</select><small>Only CVs with plain text can be matched or tailored.</small></label>
            <label>Job description<textarea rows={10} value={jobDescription} onChange={(event) => { setJobDescription(event.target.value); setResult(null) }} /></label>
          </section>

          {textCVs.length === 0 && <div className="error-banner" role="alert">Add plain text to a CV in the CV library before using this tool.</div>}
          {match && <section className="match-panel" aria-label="CV match result"><div><span>Keyword match</span><strong className={match.score >= 60 ? 'good' : match.score >= 35 ? 'fair' : 'low'}>{match.score}%</strong><small>{match.matched} of {match.total} distinct job terms appear in this CV.</small></div>{best && best.cv.id !== selectedCV?.id && <p>Best current version: <strong>{best.cv.name}</strong> ({best.match.score}%).</p>}<div><strong>Missing terms to consider truthfully</strong><div className="keyword-list">{match.missing.length ? match.missing.map((word) => <span className="tag" key={word}>{word}</span>) : <span className="muted">No material gaps found.</span>}</div></div><small>This is a simple keyword-overlap guide, not a hiring prediction.</small></section>}

          <div className="button-row"><button className="button primary" disabled={running || busy || !selectedCV || !jobDescription.trim()} onClick={() => void runAI()}>{running ? 'Creating draft…' : 'Tailor with AI'}</button></div>
          {error && <div className="error-banner" role="alert">{error}</div>}
          {actionError && <div className="error-banner" role="alert">{actionError}</div>}
          {notice && <div className="notice-banner" role="status">{notice}</div>}
          {actionNotice && <div className="notice-banner" role="status">{actionNotice}</div>}

          {result && selectedCV && <section className="tailor-output">
            <div className="ai-review-warning"><strong>Review required</strong><span>AI can make mistakes. Confirm every employer, date, skill, metric, and achievement against your real CV before using this draft.</span></div>
            <label>Tailored summary<textarea rows={5} value={result.summary} onChange={(event) => updateResult('summary', event.target.value)} /></label>
            <label>Tailored bullet points<textarea rows={10} value={result.bullets.join('\n')} onChange={(event) => updateResult('bullets', event.target.value.split('\n').map((item) => item.replace(/^\s*[•*-]\s*/, '').trim()).filter(Boolean))} /></label>
            <label>Cover letter<textarea rows={12} value={result.cover_letter} onChange={(event) => updateResult('cover_letter', event.target.value)} /></label>
            {result.keywords_added.length > 0 && <div><strong>Aligned terms</strong><div className="keyword-list">{result.keywords_added.map((word) => <span className="tag" key={word}>{word}</span>)}</div></div>}
            {result.review_notes.length > 0 && <div className="review-notes"><strong>Items to verify</strong><ul>{result.review_notes.map((note) => <li key={note}>{note}</li>)}</ul></div>}
            <small>Generated with {result.model}. The saved CV remains editable text.</small>
            <div className="button-row"><button className="button secondary" disabled={busy} onClick={() => void copyResult()}>Copy all</button><button className="button secondary" disabled={busy} onClick={() => void onUseCoverLetter(result)}>Use cover letter in email</button><button className="button primary" disabled={busy} onClick={() => void onSaveCV(selectedCV, result)}>{busy ? 'Saving…' : 'Save and link CV version'}</button></div>
          </section>}
        </div>
      </section>
    </div>
  )
}
