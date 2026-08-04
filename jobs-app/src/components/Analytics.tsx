import { useMemo } from 'react'
import {
  INTERVIEW_STATUSES,
  OFFER_STATUSES,
  RESPONSE_STATUSES,
  isApplied,
  medianDaysToFirstResponse,
  overdueCounts,
  reachedStatuses,
  resultsByCV,
  resultsBySource,
  shareLabel,
  stageFunnel,
  weeklyApplications,
  type GroupOutcome,
} from '../lib/analytics'
import type { CV, Contact, Job, JobStageEvent } from '../types'

type AnalyticsViewProps = {
  jobs: Job[]
  contacts: Contact[]
  cvs: CV[]
  stageEvents: JobStageEvent[]
}

function OutcomeTable({ title, note, rows }: { title: string; note: string; rows: GroupOutcome[] }) {
  return (
    <section className="workspace-card panel">
      <div className="panel-head"><div><p className="eyebrow">Where results come from</p><h2>{title}</h2></div></div>
      {rows.length === 0 ? <div className="compact-empty">{note}</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{title}</th><th>Saved</th><th>Applied</th><th>Interviews</th><th>Offers</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td><strong>{row.label}</strong></td>
                  <td>{row.total}</td>
                  <td>{row.applied}</td>
                  <td>{row.interviews}</td>
                  <td>{row.offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function AnalyticsView({ jobs, contacts, cvs, stageEvents }: AnalyticsViewProps) {
  const reached = useMemo(() => reachedStatuses(jobs, stageEvents), [jobs, stageEvents])
  const appliedJobs = useMemo(() => jobs.filter((job) => isApplied(job, reached)), [jobs, reached])
  const responded = useMemo(() => appliedJobs.filter((job) => {
    const set = reached.get(job.id)
    return Boolean(set && RESPONSE_STATUSES.some((status) => set.has(status)))
  }), [appliedJobs, reached])
  const interviewed = useMemo(() => appliedJobs.filter((job) => {
    const set = reached.get(job.id)
    return Boolean(set && INTERVIEW_STATUSES.some((status) => set.has(status)))
  }), [appliedJobs, reached])
  const offers = useMemo(() => appliedJobs.filter((job) => {
    const set = reached.get(job.id)
    return Boolean(set && OFFER_STATUSES.some((status) => set.has(status)))
  }), [appliedJobs, reached])

  const weekly = useMemo(() => weeklyApplications(jobs), [jobs])
  const weeklyMax = Math.max(1, ...weekly.map((week) => week.count))
  const funnel = useMemo(() => stageFunnel(jobs, reached), [jobs, reached])
  const firstResponse = useMemo(() => medianDaysToFirstResponse(stageEvents), [stageEvents])
  const bySource = useMemo(() => resultsBySource(jobs, reached), [jobs, reached])
  const byCV = useMemo(() => resultsByCV(jobs, cvs, reached), [cvs, jobs, reached])
  const overdue = useMemo(() => overdueCounts(jobs, contacts), [contacts, jobs])

  return (
    <>
      <section className="metrics" aria-label="Search results summary">
        <article><span>Applications sent</span><strong>{appliedJobs.length}</strong></article>
        <article><span>Any response</span><strong>{responded.length}</strong><small className="metric-note">{shareLabel(responded.length, appliedJobs.length)}</small></article>
        <article><span>Reached interviews</span><strong>{interviewed.length}</strong><small className="metric-note">{shareLabel(interviewed.length, appliedJobs.length)}</small></article>
        <article><span>Offers</span><strong>{offers.length}</strong><small className="metric-note">{shareLabel(offers.length, appliedJobs.length)}</small></article>
      </section>

      <div className="dashboard-grid">
        <section className="workspace-card panel">
          <div className="panel-head"><div><p className="eyebrow">Weekly effort</p><h2>Applications per week</h2></div></div>
          <div className="pipeline-chart">
            {weekly.map((week) => (
              <div className="pipeline-row" key={week.weekStart}>
                <span>{week.label}</span>
                <div><i style={{ width: `${(week.count / weeklyMax) * 100}%` }} /></div>
                <strong>{week.count}</strong>
              </div>
            ))}
          </div>
          <p className="analytics-note">Counted by the applied date on each application over the last 8 weeks.</p>
        </section>

        <section className="workspace-card panel">
          <div className="panel-head"><div><p className="eyebrow">Conversion</p><h2>Stage funnel</h2></div></div>
          <div className="pipeline-chart">
            {funnel.map((stage, index) => (
              <div className="pipeline-row" key={stage.key}>
                <span>{stage.label}</span>
                <div><i style={{ width: `${(stage.count / Math.max(1, funnel[0].count)) * 100}%` }} /></div>
                <strong>{index === 0 ? stage.count : shareLabel(stage.count, funnel[0].count)}</strong>
              </div>
            ))}
          </div>
          <p className="analytics-note">
            {firstResponse.medianDays == null
              ? 'Median response time appears after status changes are recorded live (existing applications only carry their current state).'
              : `Median time from applying to the first response: ${firstResponse.medianDays} days, measured on ${firstResponse.sample} application${firstResponse.sample === 1 ? '' : 's'} with live-recorded history.`}
            {(overdue.jobs > 0 || overdue.contacts > 0) && ` Overdue right now: ${overdue.jobs} application follow-up${overdue.jobs === 1 ? '' : 's'} and ${overdue.contacts} networking follow-up${overdue.contacts === 1 ? '' : 's'}.`}
          </p>
        </section>
      </div>

      <div className="dashboard-grid">
        <OutcomeTable title="By source" note="Record a source on your applications to compare where interviews come from." rows={bySource} />
        <OutcomeTable title="By CV version" note="Link CVs to applications to compare which version performs better." rows={byCV} />
      </div>

      <p className="analytics-note standalone">These are your own counts, not predictions. With small samples, one reply can move every percentage — read the absolute numbers first.</p>
    </>
  )
}
