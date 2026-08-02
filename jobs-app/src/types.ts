export const JOB_STATUSES = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'closed',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export type Job = {
  id: string
  user_id: string
  company: string
  role_title: string
  status: JobStatus
  location: string | null
  job_url: string | null
  source: string | null
  salary_text: string | null
  contact_name: string | null
  contact_email: string | null
  applied_at: string | null
  next_action_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  version: number
  data: Record<string, unknown>
}

export type JobDraft = {
  company: string
  role_title: string
  status: JobStatus
  location: string
  job_url: string
  source: string
  salary_text: string
  contact_name: string
  contact_email: string
  applied_at: string
  next_action_at: string
  notes: string
}

export const EMPTY_JOB: JobDraft = {
  company: '',
  role_title: '',
  status: 'saved',
  location: '',
  job_url: '',
  source: '',
  salary_text: '',
  contact_name: '',
  contact_email: '',
  applied_at: '',
  next_action_at: '',
  notes: '',
}
