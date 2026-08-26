import { useMemo, useState } from 'react'
import { INTERVIEW_STAGE_STATUSES, likelyInterviewTopics, prepToDraft, rankStarStories } from '../lib/networking'
import { formatDateTime } from '../lib/opportunities'
import {
  PREP_CHECKLIST,
  STATUS_LABELS,
  type InterviewPrep,
  type InterviewPrepDraft,
  type InterviewPrepSaveResult,
  type Job,
  type StarStory,
} from '../types'

const STORY_PARTS: Array<{ key: 'situation' | 'task' | 'action' | 'result'; label: string }> = [
  { key: 'situation', label: 'S' },
  { key: 'task', label: 'T' },
  { key: 'action', label: 'A' },
  { key: 'result', label: 'R' },
]

type InterviewPrepViewProps = {
  jobs: Job[]
  preps: InterviewPrep[]
  stories: StarStory[]
  busy: boolean
  onSavePrep: (job: Job, existing: InterviewPrep | null, draft: InterviewPrepDraft) => Promise<InterviewPrepSaveResult>
  onAddStory: () => void
  onViewStory: (story: StarStory) => void
  onEditStory: (story: StarStory) => void
  onDeleteStory: (story: StarStory) => Promise<void>
}

export function InterviewPrepView({ jobs, preps, stories, busy, onSavePrep, onAddStory, onViewStory, onEditStory, onDeleteStory }: InterviewPrepViewProps) {
  const upcoming = useMemo(() => jobs
    .filter((job) => INTERVIEW_STAGE_STATUSES.includes(job.status))
    .sort((left, right) => {
      if (!left.next_action_at && !right.next_action_at) return left.company.localeCompare(right.company)
      if (!left.next_action_at) return 1
      if (!right.next_action_at) return -1
      return new Date(left.next_action_at).getTime() - new Date(right.next_action_at).getTime()
    }), [jobs])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const selectedJob = upcoming.find((job) => job.id === selectedJobId) ?? upcoming[0] ?? null
  const selectedPrep = selectedJob ? preps.find((prep) => prep.job_id === selectedJob.id) ?? null : null

  return (
    <>
      <div className="prep-layout">
        <section className="workspace-card panel">
          <div className="panel-head"><div><p className="eyebrow">Interview stages</p><h2>Upcoming interviews</h2></div></div>
          {upcoming.length === 0 ? (
            <div className="compact-empty">Move an application to Phone screen, Interview, Assessment, or Final round to prepare for it here.</div>
          ) : (
            <div className="attention-list">
              {upcoming.map((job) => {
                const prep = preps.find((candidate) => candidate.job_id === job.id)
                const done = prep ? PREP_CHECKLIST.filter((item) => prep.checklist[item.key]).length : 0
                return (
                  <button key={job.id} className={selectedJob?.id === job.id ? 'selected' : ''} onClick={() => setSelectedJobId(job.id)}>
                    <span><strong>{job.role_title}</strong><small>{job.company} · {STATUS_LABELS[job.status]}</small></span>
                    <em>{job.next_action_at ? formatDateTime(job.next_action_at) : `${done}/${PREP_CHECKLIST.length} prepared`}</em>
                  </button>
                )
              })}
            </div>
          )}
        </section>
        {selectedJob && (
          <PrepPanel
            key={selectedJob.id}
            job={selectedJob}
            prep={selectedPrep}
            stories={stories}
            busy={busy}
            onViewStory={onViewStory}
            onSave={(existing, draft) => onSavePrep(selectedJob, existing, draft)}
          />
        )}
      </div>

      <section className="workspace-card">
        <div className="workspace-head">
          <div><p className="eyebrow">Reusable evidence</p><h2>{stories.length} STAR stories</h2></div>
          <button className="button secondary" onClick={onAddStory}>+ Add STAR story</button>
        </div>
        {stories.length === 0 ? (
          <div className="empty-state">
            <strong>Build your STAR library</strong>
            <span>Write down verified Situation–Task–Action–Result examples once, then reuse them for every interview. Keep them factual.</span>
            <button className="button primary" onClick={onAddStory}>Add your first story</button>
          </div>
        ) : (
          <div className="cv-grid">
            {stories.map((story) => (
              <article className="cv-card story-card" key={story.id}>
                <div className="cv-card-head">
                  <span className="cv-file-mark" aria-hidden="true">★</span>
                  <div>
                    <h3><button className="story-open" type="button" onClick={() => onViewStory(story)}>{story.title}</button></h3>
                    <p>{story.skills || 'No skills tagged yet'}</p>
                  </div>
                </div>
                <dl className="story-glance">
                  {STORY_PARTS.map(({ key, label }) => {
                    const value = story[key]?.trim()
                    return (
                      <div key={key} className={value ? undefined : 'empty'}>
                        <dt>{label}</dt>
                        <dd>{value ? `${value.slice(0, 110)}${value.length > 110 ? '…' : ''}` : 'Not recorded'}</dd>
                      </div>
                    )
                  })}
                </dl>
                <div className="cv-actions">
                  <button className="button secondary" onClick={() => onViewStory(story)}>View</button>
                  <button className="button secondary" disabled={busy} onClick={() => onEditStory(story)}>Edit</button>
                  <button className="button danger" disabled={busy} onClick={() => void onDeleteStory(story)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function PrepPanel({ job, prep, stories, busy, onViewStory, onSave }: { job: Job; prep: InterviewPrep | null; stories: StarStory[]; busy: boolean; onViewStory: (story: StarStory) => void; onSave: (existing: InterviewPrep | null, draft: InterviewPrepDraft) => Promise<InterviewPrepSaveResult> }) {
  const [draft, setDraft] = useState<InterviewPrepDraft>(() => prepToDraft(prep))
  // The optimistic-lock baseline stays bound to the record this draft was loaded
  // from, not the live prop, so a Realtime refresh cannot silently raise the
  // expected version underneath unsaved edits.
  const [basePrep, setBasePrep] = useState<InterviewPrep | null>(prep)
  const topics = useMemo(() => likelyInterviewTopics(job.job_description), [job.job_description])
  const rankedStories = useMemo(() => rankStarStories(stories, job.job_description).slice(0, 3), [stories, job.job_description])

  function toggleChecklist(key: string) {
    setDraft((current) => ({ ...current, checklist: { ...current.checklist, [key]: !current.checklist[key] } }))
  }

  async function save() {
    const result = await onSave(basePrep, draft)
    if (result) setBasePrep(result.prep)
  }

  return (
    <section className="workspace-card panel prep-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Preparation workspace</p>
          <h2>{job.role_title} · {job.company}</h2>
        </div>
        {job.next_action_at && <span className="prep-when">{job.next_action || 'Interview'} · {formatDateTime(job.next_action_at)}</span>}
      </div>

      <div className="prep-block">
        <strong>Likely topics from the job description</strong>
        {topics.length ? <div className="topic-chips">{topics.map((topic) => <span key={topic}>{topic}</span>)}</div> : <p className="compact-empty">Add the job description to this application to see likely topics.</p>}
      </div>

      <div className="prep-block">
        <strong>Most relevant STAR stories</strong>
        {rankedStories.length ? (
          <ul className="ranked-stories">
            {rankedStories.map(({ story, score }) => <li key={story.id}><button className="story-open" type="button" onClick={() => onViewStory(story)}>{story.title}</button><em>{score}% keyword match</em></li>)}
          </ul>
        ) : <p className="compact-empty">{stories.length ? 'No story matches this job description yet.' : 'Add STAR stories below to see which fit this interview.'}</p>}
      </div>

      <div className="prep-block">
        <strong>Preparation checklist</strong>
        <div className="checklist-grid">
          {PREP_CHECKLIST.map((item) => (
            <label className="check-label" key={item.key}>
              <input type="checkbox" checked={Boolean(draft.checklist[item.key])} onChange={() => toggleChecklist(item.key)} />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <label>Company research and notes<textarea rows={5} value={draft.research_notes} placeholder="Product, funding, culture signals, people you will meet…" onChange={(event) => setDraft({ ...draft, research_notes: event.target.value })} /></label>
      <label>Questions to ask<textarea rows={4} value={draft.questions_to_ask} placeholder="One question per line." onChange={(event) => setDraft({ ...draft, questions_to_ask: event.target.value })} /></label>
      <label>Post-interview notes<textarea rows={4} value={draft.post_interview_notes} placeholder="What was asked, how it went, agreed next steps. Remember the thank-you message." onChange={(event) => setDraft({ ...draft, post_interview_notes: event.target.value })} /></label>

      <div className="button-row">
        <button className="button primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save preparation'}</button>
      </div>
    </section>
  )
}
