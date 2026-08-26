import { useEffect, useMemo, useState } from 'react'
import {
  assembleCVText,
  buildCandidates,
  coverageReport,
  roleRequirements,
  type BuilderItem,
} from '../lib/cvBuilder'
import { CV_BLOCK_TYPE_LABELS, type CVBlock, type Job, type StarStory } from '../types'

export type BuiltCV = {
  name: string
  text: string
  job: Job | null
  linkToJob: boolean
}

type CVBuilderProps = {
  jobs: Job[]
  blocks: CVBlock[]
  stories: StarStory[]
  busy: boolean
  error: string
  notice: string
  onClose: () => void
  onSave: (built: BuiltCV) => Promise<void>
}

function itemKey(item: BuilderItem) {
  return `${item.kind}:${item.id}`
}

export function CVBuilder({ jobs, blocks, stories, busy, error, notice, onClose, onSave }: CVBuilderProps) {
  const targetableJobs = useMemo(
    () => jobs.filter((job) => job.job_description?.trim()).sort((left, right) => left.company.localeCompare(right.company)),
    [jobs],
  )
  // The target is captured when it is chosen, not read from the live jobs
  // list. A Realtime reload would otherwise swap in a newer row and version,
  // and the CV link would then pass the optimistic-lock check against a change
  // this builder never saw.
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [pasted, setPasted] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [draftText, setDraftText] = useState('')
  const [edited, setEdited] = useState(false)
  const [name, setName] = useState('')
  const [linkToJob, setLinkToJob] = useState(true)
  const [validationError, setValidationError] = useState('')

  const jobDescription = selectedJob?.job_description ?? (pasted.trim() || null)
  const targetMissing = Boolean(selectedJob) && !targetableJobs.some((job) => job.id === selectedJob?.id)

  const requirements = useMemo(() => roleRequirements(jobDescription), [jobDescription])
  const candidates = useMemo(() => buildCandidates(blocks, stories, jobDescription), [blocks, stories, jobDescription])
  const selectedItems = useMemo(
    () => candidates.filter((item) => selectedKeys.has(itemKey(item))),
    [candidates, selectedKeys],
  )
  const assembled = useMemo(() => assembleCVText(selectedItems), [selectedItems])
  const coverage = useMemo(() => coverageReport(selectedItems, jobDescription), [selectedItems, jobDescription])

  // The preview follows the selection until the text is edited by hand, after
  // which it is left alone and a regenerate action is offered instead.
  useEffect(() => {
    if (!edited) setDraftText(assembled)
  }, [assembled, edited])

  useEffect(() => {
    if (selectedJob && !name.trim()) setName(`${selectedJob.company} — ${selectedJob.role_title}`)
  }, [name, selectedJob])

  /**
   * Everything on screen belongs to one target role, so switching targets
   * clears the selection, the assembled text, and the auto-filled name. Work
   * that would be lost is confirmed first.
   */
  function changeTarget(nextJob: Job | null) {
    const hasWork = selectedKeys.size > 0 || (edited && draftText.trim().length > 0)
    if (hasWork && !window.confirm('Changing the target role clears the current selection and the assembled text. Continue?')) return
    setSelectedJob(nextJob)
    setSelectedKeys(new Set())
    setDraftText('')
    setEdited(false)
    setName('')
    setValidationError('')
    if (nextJob) setPasted('')
  }

  function toggle(item: BuilderItem) {
    const key = itemKey(item)
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectTopMatches() {
    setSelectedKeys(new Set(candidates.filter((item) => item.matched.length > 0).map(itemKey)))
  }

  async function save() {
    setValidationError('')
    if (!name.trim()) {
      setValidationError('Give this CV version a name before saving.')
      return
    }
    if (!draftText.trim()) {
      setValidationError('Select at least one block or story, or write something in the preview.')
      return
    }
    await onSave({
      name: name.trim(),
      text: draftText,
      job: selectedJob,
      linkToJob: Boolean(selectedJob) && linkToJob,
    })
  }

  const staleSinceEdit = edited && draftText !== assembled

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal builder-modal" role="dialog" aria-modal="true" aria-labelledby="cv-builder-title">
        <header className="modal-header">
          <div><p className="eyebrow">CV library</p><h2 id="cv-builder-title">Build a CV for a role</h2></div>
          <button className="icon-button" type="button" aria-label="Close" disabled={busy} onClick={onClose}>×</button>
        </header>

        <div className="builder-body">
          <section className="builder-target">
            <label>Target role
              <select
                value={selectedJob?.id ?? ''}
                onChange={(event) => changeTarget(targetableJobs.find((job) => job.id === event.target.value) ?? null)}
              >
                <option value="">Paste requirements instead</option>
                {targetMissing && selectedJob && <option value={selectedJob.id}>{selectedJob.role_title} · {selectedJob.company}</option>}
                {targetableJobs.map((job) => <option key={job.id} value={job.id}>{job.role_title} · {job.company}</option>)}
              </select>
              <small>{targetableJobs.length ? 'Only applications that have a job description are listed.' : 'No application has a job description yet, so paste the requirements below.'}</small>
            </label>
            {targetMissing && <p className="builder-stale full" role="status">This application changed or was removed elsewhere. The builder is still working from the version you selected; saving will report a conflict rather than overwrite it.</p>}
            {!selectedJob && (
              <label className="full">Role requirements
                <textarea rows={4} value={pasted} placeholder="Paste the job description or the requirements section." onChange={(event) => setPasted(event.target.value)} />
              </label>
            )}
            {requirements.length > 0 && (
              <div className="builder-requirements full">
                <strong>What this role keeps asking for</strong>
                <div className="topic-chips">{requirements.map((requirement) => (
                  <span key={requirement} className={coverage.covered.includes(requirement) ? 'covered' : undefined}>{requirement}</span>
                ))}</div>
                <small>Terms shaded green are evidenced by your current selection. This is word overlap, not a judgement of fit.</small>
              </div>
            )}
          </section>

          <div className="builder-columns">
            <section className="builder-blocks">
              <div className="builder-column-head">
                <div><strong>Your blocks and stories</strong><span>{candidates.length} available{requirements.length ? ', best match first' : ''}</span></div>
                {requirements.length > 0 && <button className="button ghost" type="button" onClick={selectTopMatches}>Select all matching</button>}
              </div>
              {candidates.length === 0 ? (
                <p className="compact-empty">Add reusable CV blocks or STAR stories first — the builder only ever uses text you have written.</p>
              ) : (
                <ul className="builder-candidates">
                  {candidates.map((item) => {
                    const key = itemKey(item)
                    return (
                      <li key={key} className={selectedKeys.has(key) ? 'selected' : undefined}>
                        <label className="check-label">
                          <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(item)} />
                          <span className="builder-candidate">
                            <strong>{item.title}</strong>
                            <span className="builder-candidate-meta">
                              <em>{item.kind === 'story' ? 'STAR story' : CV_BLOCK_TYPE_LABELS[item.blockType]}</em>
                              {item.matched.length > 0 && <em className="matched">covers {item.matched.slice(0, 6).join(', ')}</em>}
                            </span>
                            <span className="builder-candidate-text">{item.text.slice(0, 160)}{item.text.length > 160 ? '…' : ''}</span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="builder-preview">
              <div className="builder-column-head">
                <div><strong>Assembled CV</strong><span>{selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} selected</span></div>
                {staleSinceEdit && <button className="button ghost" type="button" onClick={() => { setDraftText(assembled); setEdited(false) }}>Rebuild from selection</button>}
              </div>
              {staleSinceEdit && <p className="builder-stale" role="status">The selection changed after you edited this text. Rebuilding replaces your edits.</p>}
              <textarea
                rows={18}
                value={draftText}
                placeholder="Select blocks and stories on the left, then edit the assembled text here before saving."
                onChange={(event) => { setDraftText(event.target.value); setEdited(true) }}
              />
              {coverage.missing.length > 0 && (
                <p className="builder-gap">
                  Not evidenced yet: {coverage.missing.slice(0, 8).join(', ')}. Add a block if you genuinely have that experience; do not write it in because the advert asked for it.
                </p>
              )}
            </section>
          </div>

          <section className="builder-save">
            <label>CV version name<input value={name} placeholder="Company — Role" onChange={(event) => setName(event.target.value)} /></label>
            {selectedJob && (
              <label className="check-label">
                <input type="checkbox" checked={linkToJob} onChange={(event) => setLinkToJob(event.target.checked)} />
                Link this CV to {selectedJob.role_title} at {selectedJob.company}
              </label>
            )}
            <p className="builder-note">Saving creates a new text CV in your library. Existing CVs are never overwritten, and every line above came from your own blocks and stories.</p>
          </section>

          {(validationError || error) && <p className="form-message error-text" role="alert">{validationError || error}</p>}
          {notice && <p className="form-message" role="status">{notice}</p>}
        </div>

        <div className="form-actions builder-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>Close</button>
          <button className="button primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save as new CV version'}</button>
        </div>
      </section>
    </div>
  )
}
