import { draftToPayload, isJobStatus, isPriority, isWorkMode, toLocalDateTimeInput } from './opportunities'
import { EMPTY_JOB, type CV, type Job, type JobDraft, type JobStatus } from '../types'

/** A parsed backup file, before the user confirms the import. */
export type ParsedBackup = { jobs: unknown[]; isLegacyBackup: boolean }

export function parseBackup(text: string): ParsedBackup {
  const parsed = JSON.parse(text) as { opportunityDeskVersion?: unknown; jobs?: unknown }
  if (!Array.isArray(parsed.jobs) || (parsed.opportunityDeskVersion !== undefined && parsed.opportunityDeskVersion !== 1)) {
    throw new Error('This is not a recognized Opportunity Desk backup.')
  }
  if (parsed.jobs.length > 1000) throw new Error('This backup is too large to import safely in one step.')
  return { jobs: parsed.jobs, isLegacyBackup: parsed.opportunityDeskVersion === undefined }
}

function legacyStatus(value: unknown): JobStatus {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const statuses: Record<string, JobStatus> = {
    wishlist: 'saved',
    saved: 'saved',
    applied: 'applied',
    'phone screen': 'phone_screen',
    interview: 'interviewing',
    interviewing: 'interviewing',
    assessment: 'assessment',
    'final round': 'final_round',
    offer: 'offer',
    accepted: 'accepted',
    rejected: 'rejected',
    withdrawn: 'withdrawn',
    'on hold': 'on_hold',
    closed: 'closed',
  }
  return statuses[normalized] ?? 'saved'
}

function legacyWorkMode(value: unknown): JobDraft['work_mode'] {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'remote' || normalized === 'hybrid') return normalized
  if (normalized === 'on-site' || normalized === 'onsite') return 'onsite'
  return 'unspecified'
}

function legacyPriority(value: unknown): JobDraft['priority'] {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isPriority(normalized) ? normalized : 'medium'
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function legacyRow(candidate: object, userId: string) {
  const legacy = candidate as Record<string, unknown>
  if (typeof legacy.company !== 'string' || !legacy.company.trim()) throw new Error('The older backup contains an application without a company.')
  const legacyDraft: JobDraft = {
    ...EMPTY_JOB,
    company: legacy.company,
    role_title: typeof legacy.role === 'string' && legacy.role.trim() ? legacy.role : 'Role not specified',
    status: legacyStatus(legacy.status),
    priority: legacyPriority(legacy.priority),
    work_mode: legacyWorkMode(legacy.mode),
    location: text(legacy.location),
    job_url: text(legacy.url),
    source: text(legacy.source),
    salary_text: text(legacy.salary),
    contact_name: text(legacy.contact),
    contact_email: text(legacy.email),
    applied_at: text(legacy.applied),
    next_action: text(legacy.next),
    next_action_at: typeof legacy.nextDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(legacy.nextDate) ? `${legacy.nextDate}T09:00` : '',
    job_description: text(legacy.jobDesc),
    notes: text(legacy.notes),
    email_recipient: text(legacy.sendto) || text(legacy.email),
    email_subject: text(legacy.emailSubject),
    email_body: text(legacy.emailBody),
  }
  return { user_id: userId, ...draftToPayload(legacyDraft) }
}

function currentRow(candidate: object, userId: string, cvs: CV[]) {
  const job = candidate as Partial<Job>
  if (!job.id || !job.company || !job.role_title || !isJobStatus(job.status) || !isPriority(job.priority) || !isWorkMode(job.work_mode)) {
    throw new Error('The backup contains an incomplete application.')
  }
  return {
    id: job.id,
    user_id: userId,
    ...draftToPayload({
      ...EMPTY_JOB,
      company: job.company,
      role_title: job.role_title,
      status: job.status,
      priority: job.priority,
      work_mode: job.work_mode,
      location: job.location ?? '',
      job_url: job.job_url ?? '',
      source: job.source ?? '',
      salary_text: job.salary_text ?? '',
      contact_name: job.contact_name ?? '',
      contact_email: job.contact_email ?? '',
      applied_at: job.applied_at ?? '',
      next_action: job.next_action ?? '',
      next_action_at: toLocalDateTimeInput(job.next_action_at ?? null),
      job_description: job.job_description ?? '',
      notes: job.notes ?? '',
      external_job_id: job.external_job_id ?? '',
      email_recipient: job.email_recipient ?? '',
      email_subject: job.email_subject ?? '',
      email_body: job.email_body ?? '',
      cv_id: job.cv_id && cvs.some((cv) => cv.id === job.cv_id) ? job.cv_id : '',
    }),
    data: job.data ?? {},
  }
}

/** Turns backup entries into rows ready to be written, rejecting invalid ones. */
export function backupRows(backup: ParsedBackup, userId: string, cvs: CV[]) {
  return backup.jobs.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('The backup contains an invalid application.')
    return backup.isLegacyBackup ? legacyRow(candidate, userId) : currentRow(candidate, userId, cvs)
  })
}
