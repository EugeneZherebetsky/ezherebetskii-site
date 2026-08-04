import { describe, expect, it } from 'vitest'
import {
  isApplied,
  medianDaysToFirstResponse,
  overdueCounts,
  reachedStatuses,
  resultsByCV,
  resultsBySource,
  shareLabel,
  stageFunnel,
  weeklyApplications,
} from './analytics'
import type { Contact, CV, Job, JobStageEvent, JobStatus } from '../types'

function job(overrides: Partial<Job>): Job {
  return {
    id: 'job-1',
    user_id: 'user-1',
    company: 'Acme',
    role_title: 'Engineer',
    status: 'saved',
    work_mode: 'unspecified',
    priority: 'medium',
    location: null,
    job_url: null,
    source: null,
    salary_text: null,
    contact_name: null,
    contact_email: null,
    applied_at: null,
    next_action: null,
    next_action_at: null,
    job_description: null,
    notes: null,
    external_job_id: null,
    email_recipient: null,
    email_subject: null,
    email_body: null,
    cv_id: null,
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
    version: 1,
    data: {},
    ...overrides,
  }
}

function event(overrides: Partial<JobStageEvent>): JobStageEvent {
  return {
    id: crypto.randomUUID(),
    user_id: 'user-1',
    job_id: 'job-1',
    from_status: null,
    to_status: 'saved',
    event_type: 'status_change',
    occurred_at: '2026-07-01T10:00:00.000Z',
    details: { historical_timestamp_reliable: true },
    ...overrides,
  }
}

describe('reachedStatuses and isApplied', () => {
  it('combines event history with the current status', () => {
    const rejected = job({ id: 'a', status: 'rejected' })
    const events = [event({ job_id: 'a', from_status: 'applied', to_status: 'interviewing' })]
    const reached = reachedStatuses([rejected], events)
    expect(reached.get('a')).toEqual(new Set<JobStatus>(['applied', 'interviewing', 'rejected']))
    expect(isApplied(rejected, reached)).toBe(true)
  })

  it('treats a saved job without history as not applied', () => {
    const saved = job({ id: 'b', status: 'saved' })
    expect(isApplied(saved, reachedStatuses([saved], []))).toBe(false)
  })
})

describe('stageFunnel', () => {
  it('counts each stage a job has ever reached', () => {
    const jobs = [
      job({ id: 'a', status: 'rejected', applied_at: '2026-07-01' }),
      job({ id: 'b', status: 'interviewing', applied_at: '2026-07-02' }),
      job({ id: 'c', status: 'accepted', applied_at: '2026-07-03' }),
      job({ id: 'd', status: 'saved' }),
    ]
    const events = [event({ job_id: 'c', from_status: 'final_round', to_status: 'offer' })]
    const funnel = stageFunnel(jobs, reachedStatuses(jobs, events))
    expect(funnel.map((stage) => [stage.key, stage.count])).toEqual([
      ['applied', 3],
      ['response', 3],
      ['interview', 2],
      ['offer', 1],
      ['accepted', 1],
    ])
  })
})

describe('weeklyApplications', () => {
  it('buckets applied dates into Monday-based weeks', () => {
    const now = new Date('2026-08-04T12:00:00') // Tuesday
    const jobs = [
      job({ id: 'a', applied_at: '2026-08-03' }), // this week (Mon)
      job({ id: 'b', applied_at: '2026-08-01' }), // previous week (Sat)
      job({ id: 'c', applied_at: '2026-07-28' }), // previous week (Tue)
      job({ id: 'd', applied_at: '2020-01-01' }), // far outside the window
      job({ id: 'e', applied_at: null }),
    ]
    const weeks = weeklyApplications(jobs, 4, now)
    expect(weeks).toHaveLength(4)
    expect(weeks[3].count).toBe(1)
    expect(weeks[2].count).toBe(2)
    expect(weeks[0].count + weeks[1].count).toBe(0)
  })
})

describe('medianDaysToFirstResponse', () => {
  it('measures applied-to-response and ignores synthetic backfills', () => {
    const events = [
      event({ job_id: 'a', to_status: 'applied', occurred_at: '2026-07-01T00:00:00.000Z' }),
      event({ job_id: 'a', to_status: 'phone_screen', occurred_at: '2026-07-05T00:00:00.000Z' }),
      event({ job_id: 'b', to_status: 'applied', occurred_at: '2026-07-01T00:00:00.000Z' }),
      event({ job_id: 'b', to_status: 'rejected', occurred_at: '2026-07-03T00:00:00.000Z' }),
      event({ job_id: 'c', to_status: 'interviewing', event_type: 'backfill_current_state', details: { historical_timestamp_reliable: false } }),
      event({ job_id: 'd', to_status: 'applied', occurred_at: '2026-07-01T00:00:00.000Z' }),
    ]
    const { medianDays, sample } = medianDaysToFirstResponse(events)
    expect(sample).toBe(2)
    expect(medianDays).toBe(3)
  })

  it('returns no median without live-recorded pairs', () => {
    expect(medianDaysToFirstResponse([]).medianDays).toBeNull()
  })
})

describe('resultsBySource and resultsByCV', () => {
  it('groups outcomes with sensible fallbacks', () => {
    const jobs = [
      job({ id: 'a', source: 'LinkedIn', status: 'interviewing', applied_at: '2026-07-01' }),
      job({ id: 'b', source: 'LinkedIn', status: 'saved' }),
      job({ id: 'c', source: null, status: 'offer', applied_at: '2026-07-02', cv_id: 'cv-1' }),
    ]
    const reached = reachedStatuses(jobs, [])
    const bySource = resultsBySource(jobs, reached)
    expect(bySource[0]).toMatchObject({ label: 'LinkedIn', total: 2, applied: 1, interviews: 1 })
    expect(bySource[1]).toMatchObject({ label: 'No source recorded', total: 1, offers: 1 })

    const cvs = [{ id: 'cv-1', name: 'Data CV' } as CV]
    const byCV = resultsByCV(jobs, cvs, reached)
    expect(byCV).toHaveLength(1)
    expect(byCV[0]).toMatchObject({ label: 'Data CV', total: 1, offers: 1 })
  })
})

describe('overdueCounts and shareLabel', () => {
  it('counts overdue active items only', () => {
    const now = new Date('2026-08-04T12:00:00.000Z')
    const jobs = [
      job({ id: 'a', status: 'applied', next_action_at: '2026-08-01T12:00:00.000Z' }),
      job({ id: 'b', status: 'rejected', next_action_at: '2026-08-01T12:00:00.000Z' }),
    ]
    const contacts = [
      { id: 'x', pipeline_stage: 'contacted', next_action_at: '2026-08-02T12:00:00.000Z' } as Contact,
      { id: 'y', pipeline_stage: 'closed', next_action_at: '2026-08-02T12:00:00.000Z' } as Contact,
    ]
    expect(overdueCounts(jobs, contacts, now)).toEqual({ jobs: 1, contacts: 1 })
  })

  it('never renders a percentage without its counts', () => {
    expect(shareLabel(1, 3)).toBe('1 of 3 (33%)')
    expect(shareLabel(0, 0)).toBe('no data yet')
  })
})
