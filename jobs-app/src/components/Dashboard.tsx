import { relativeDueLabel } from '../lib/opportunities'
import { JOB_STATUSES, STATUS_LABELS, type Job } from '../types'

export type DashboardCounts = { active: number; interviews: number; offers: number; followUps: number }

type DashboardViewProps = {
  jobs: Job[]
  counts: DashboardCounts
  reminders: Job[]
  onEdit: (job: Job) => void
  onViewAll: () => void
}

export function DashboardView({ jobs, counts, reminders, onEdit, onViewAll }: DashboardViewProps) {
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
