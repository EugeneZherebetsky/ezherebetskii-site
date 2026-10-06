import { useState, type DragEvent } from 'react'
import { BOARD_COLUMNS, relativeDueLabel } from '../lib/opportunities'
import { JOB_STATUSES, STATUS_LABELS, type CV, type Job, type JobStatus } from '../types'
import { JobBadges } from './JobBadges'

type BoardViewProps = {
  jobs: Job[]
  cvs: CV[]
  busy: boolean
  onEdit: (job: Job) => void
  onStatus: (job: Job, status: JobStatus) => Promise<void>
  onCV: (job: Job, cvId: string | null) => Promise<void>
}

export function BoardView({ jobs, cvs, busy, onEdit, onStatus, onCV }: BoardViewProps) {
  const [dragOverJobId, setDragOverJobId] = useState<string | null>(null)

  function startCVDrag(event: DragEvent<HTMLElement>, cv: CV) {
    event.dataTransfer.effectAllowed = 'link'
    event.dataTransfer.setData('application/x-opportunity-desk-cv', cv.id)
    event.dataTransfer.setData('text/plain', cv.id)
  }

  function dropCV(event: DragEvent<HTMLElement>, job: Job) {
    event.preventDefault()
    setDragOverJobId(null)
    const cvId = event.dataTransfer.getData('application/x-opportunity-desk-cv') || event.dataTransfer.getData('text/plain')
    if (cvs.some((cv) => cv.id === cvId)) void onCV(job, cvId)
  }

  return (
    <>
      <section className="cv-drag-panel workspace-card" aria-label="CVs available to link">
        <div><p className="eyebrow">CV assignment</p><h2>Drag a CV onto an opportunity</h2><span>On phones or with a keyboard, use the CV selector inside each card.</span></div>
        <div className="cv-drag-list">{cvs.map((cv) => <article className="cv-drag-chip" key={cv.id} draggable={!busy} onDragStart={(event) => startCVDrag(event, cv)} onDragEnd={() => setDragOverJobId(null)}><strong>{cv.name}</strong><span>{cv.tailored_company || cv.target_role || 'General CV'}</span></article>)}{cvs.length === 0 && <span className="compact-empty">Add a CV in the CV library before linking one.</span>}</div>
      </section>
      <section className="kanban" aria-label="Application board">{BOARD_COLUMNS.map((column) => {
        const columnJobs = jobs.filter((job) => column.statuses.includes(job.status))
        return <div className="kanban-column" key={column.title}><div className="kanban-head"><strong>{column.title}</strong><span>{columnJobs.length}</span></div><div className="kanban-cards">{columnJobs.map((job) => {
          const linkedCV = cvs.find((cv) => cv.id === job.cv_id)
          return <article className={dragOverJobId === job.id ? 'kanban-card cv-drop-active' : 'kanban-card'} key={job.id} onDragOver={(event) => { if (!busy && cvs.length) { event.preventDefault(); event.dataTransfer.dropEffect = 'link'; setDragOverJobId(job.id) } }} onDragLeave={() => setDragOverJobId((current) => current === job.id ? null : current)} onDrop={(event) => dropCV(event, job)}><JobBadges job={job} /><button className="card-title" onClick={() => onEdit(job)}><strong>{job.role_title}</strong><span>{job.company}</span></button>{job.next_action_at && <small>{job.next_action || 'Next action'} · {relativeDueLabel(job.next_action_at)}</small>}<div className={linkedCV ? 'linked-cv' : 'linked-cv empty'}><strong>{linkedCV ? linkedCV.name : 'Drop a CV here'}</strong><span>{linkedCV ? linkedCV.tailored_company ? `Tailored for ${linkedCV.tailored_company}` : linkedCV.original_filename || 'Text-only CV' : 'or choose one below'}</span></div><label className="compact-select">CV used<select disabled={busy} value={job.cv_id ?? ''} onChange={(event) => void onCV(job, event.target.value || null)}><option value="">No CV linked</option>{cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.name}{cv.tailored_company ? ` — ${cv.tailored_company}` : ''}</option>)}</select></label><label className="compact-select">Move to<select disabled={busy} value={job.status} onChange={(event) => void onStatus(job, event.target.value as JobStatus)}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label></article>
        })}{columnJobs.length === 0 && <div className="column-empty">No applications</div>}</div></div>
      })}</section>
    </>
  )
}
