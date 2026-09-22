import type { CV, CVBlock, Job } from '../types'

const NOW = '2026-07-01T10:00:00.000Z'

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    user_id: 'user-1',
    company: 'Acme',
    role_title: 'Engineer',
    status: 'applied',
    work_mode: 'remote',
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
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    data: {},
    ...overrides,
  } as Job
}

export function makeCV(overrides: Partial<CV> = {}): CV {
  return {
    id: 'cv-1',
    user_id: 'user-1',
    name: 'General CV',
    storage_path: null,
    target_role: null,
    notes: null,
    original_filename: null,
    mime_type: null,
    size_bytes: null,
    plain_text: null,
    tailored_company: null,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    data: {},
    ...overrides,
  }
}

export function makeCVBlock(overrides: Partial<CVBlock> = {}): CVBlock {
  return {
    id: 'block-1',
    user_id: 'user-1',
    block_type: 'achievement',
    title: 'Led a migration',
    content: 'Moved the platform to a new provider with no downtime.',
    tags: null,
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    data: {},
    ...overrides,
  }
}
