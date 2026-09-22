import { STATUS_LABELS, type Job } from '../types'

export function JobBadges({ job }: { job: Job }) {
  return (
    <div className="badges">
      <span className={`status status-${job.status}`}>{STATUS_LABELS[job.status]}</span>
      <span className={`priority priority-${job.priority}`}>{job.priority}</span>
      {job.work_mode !== 'unspecified' && <span className="tag">{job.work_mode}</span>}
    </div>
  )
}
