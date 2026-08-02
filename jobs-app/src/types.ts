export const JOB_STATUSES = [
  'saved',
  'applied',
  'phone_screen',
  'interviewing',
  'assessment',
  'final_round',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'on_hold',
  'closed',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export const STATUS_LABELS: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone screen',
  interviewing: 'Interview',
  assessment: 'Assessment',
  final_round: 'Final round',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  on_hold: 'On hold',
  closed: 'Closed',
}

export const WORK_MODES = ['unspecified', 'remote', 'hybrid', 'onsite'] as const
export type WorkMode = (typeof WORK_MODES)[number]

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type JobPriority = (typeof PRIORITIES)[number]

export const APP_VIEWS = ['dashboard', 'board', 'applications', 'reminders', 'cvs', 'search', 'backup', 'settings'] as const
export type AppView = (typeof APP_VIEWS)[number]
export type DefaultView = Extract<AppView, 'dashboard' | 'board' | 'applications' | 'reminders' | 'cvs'>

export type Job = {
  id: string
  user_id: string
  company: string
  role_title: string
  status: JobStatus
  work_mode: WorkMode
  priority: JobPriority
  location: string | null
  job_url: string | null
  source: string | null
  salary_text: string | null
  contact_name: string | null
  contact_email: string | null
  applied_at: string | null
  next_action: string | null
  next_action_at: string | null
  job_description: string | null
  notes: string | null
  external_job_id: string | null
  email_recipient: string | null
  email_subject: string | null
  email_body: string | null
  cv_id: string | null
  created_at: string
  updated_at: string
  version: number
  data: Record<string, unknown>
}

export type JobDraft = {
  company: string
  role_title: string
  status: JobStatus
  work_mode: WorkMode
  priority: JobPriority
  location: string
  job_url: string
  source: string
  salary_text: string
  contact_name: string
  contact_email: string
  applied_at: string
  next_action: string
  next_action_at: string
  job_description: string
  notes: string
  external_job_id: string
  email_recipient: string
  email_subject: string
  email_body: string
  cv_id: string
}

export type CV = {
  id: string
  user_id: string
  name: string
  storage_path: string | null
  target_role: string | null
  notes: string | null
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  plain_text: string | null
  tailored_company: string | null
  created_at: string
  updated_at: string
  version: number
  data: Record<string, unknown>
}

export type CVDraft = {
  name: string
  target_role: string
  notes: string
  plain_text: string
  tailored_company: string
}

export type ApplicationSend = {
  id: string
  user_id: string
  job_id: string
  cv_id: string | null
  sent_at: string
  recipient: string
  subject: string
  provider: string
  provider_message_id: string | null
  status: 'sent' | 'failed'
  details: Record<string, unknown>
}

export type UserSettings = {
  user_id: string
  default_view: DefaultView
  reminders_enabled: boolean
  reminder_lead_hours: number
  timezone: string
  google_client_id: string | null
  created_at: string
  updated_at: string
  version: number
}

export type SettingsDraft = Pick<UserSettings, 'default_view' | 'reminders_enabled' | 'reminder_lead_hours' | 'timezone'> & {
  google_client_id: string
}

export const EMPTY_JOB: JobDraft = {
  company: '',
  role_title: '',
  status: 'saved',
  work_mode: 'unspecified',
  priority: 'medium',
  location: '',
  job_url: '',
  source: '',
  salary_text: '',
  contact_name: '',
  contact_email: '',
  applied_at: '',
  next_action: '',
  next_action_at: '',
  job_description: '',
  notes: '',
  external_job_id: '',
  email_recipient: '',
  email_subject: '',
  email_body: '',
  cv_id: '',
}

export const EMPTY_CV: CVDraft = {
  name: '',
  target_role: '',
  notes: '',
  plain_text: '',
  tailored_company: '',
}
