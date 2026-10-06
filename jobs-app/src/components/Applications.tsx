import { formatDateTime } from '../lib/opportunities'
import { JOB_STATUSES, STATUS_LABELS, type ApplicationSend, type CV, type Job, type JobStatus } from '../types'
import { JobBadges } from './JobBadges'

type ApplicationsViewProps = {
  jobs: Job[]
  cvs: CV[]
  sends: ApplicationSend[]
  total: number
  search: string
  filter: 'all' | JobStatus
  busy: boolean
  onSearch: (value: string) => void
  onFilter: (value: 'all' | JobStatus) => void
  onEdit: (job: Job) => void
  onTailor: (job: Job) => void
  onDelete: (job: Job) => Promise<void>
  onDownloadCV: (cv: CV) => Promise<void>
}

export function ApplicationsView({ jobs, cvs, sends, total, search, filter, busy, onSearch, onFilter, onEdit, onTailor, onDelete, onDownloadCV }: ApplicationsViewProps) {
  return <section className="workspace-card"><div className="workspace-head"><div><p className="eyebrow">Your pipeline</p><h2>{total} applications</h2></div><div className="controls"><input aria-label="Search applications" placeholder="Search company, role or notes" value={search} onChange={(event) => onSearch(event.target.value)} /><select aria-label="Filter by status" value={filter} onChange={(event) => onFilter(event.target.value as 'all' | JobStatus)}><option value="all">All statuses</option>{JOB_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></div></div>{jobs.length === 0 ? <div className="empty-state"><strong>{total ? 'No matching applications' : 'Your pipeline is ready'}</strong><span>{total ? 'Try a different search or status.' : 'Add your first opportunity to start tracking it across devices.'}</span></div> : <div className="table-wrap"><table><thead><tr><th>Opportunity</th><th>Stage</th><th>CV used</th><th>Follow-up</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{jobs.map((job) => { const linkedCV = cvs.find((cv) => cv.id === job.cv_id); const lastSend = sends.find((send) => send.job_id === job.id && send.status === 'sent'); return <tr key={job.id}><td><strong>{job.role_title}</strong><span>{job.company}{job.location ? ` · ${job.location}` : ''}</span></td><td><JobBadges job={job} /></td><td>{linkedCV ? <><strong>{linkedCV.name}</strong><span>{linkedCV.tailored_company ? `Tailored for ${linkedCV.tailored_company}` : linkedCV.original_filename || 'Text-only CV'}</span>{linkedCV.storage_path && <button className="button ghost table-download" disabled={busy} onClick={() => void onDownloadCV(linkedCV)}>Download</button>}</> : <span>No CV linked</span>}{lastSend && <span className="sent-summary">Sent {formatDateTime(lastSend.sent_at)} to {lastSend.recipient}</span>}</td><td>{job.next_action_at ? <><strong>{job.next_action || 'Follow up'}</strong><span>{formatDateTime(job.next_action_at)}</span></> : <span>Not scheduled</span>}</td><td>{formatDateTime(job.updated_at)}</td><td><div className="row-actions">{job.job_url && <a className="button ghost" href={job.job_url} target="_blank" rel="noreferrer">Open</a>}<button className="button secondary" disabled={busy} onClick={() => onTailor(job)}>Tailor CV</button><button className="button secondary" onClick={() => onEdit(job)}>Edit</button><button className="button danger" disabled={busy} onClick={() => void onDelete(job)}>Delete</button></div></td></tr> })}</tbody></table></div>}</section>
}
