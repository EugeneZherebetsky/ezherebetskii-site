import { supabase } from '../lib/supabase'
import type { Job } from '../types'
import { saveVersioned, type SaveResult } from './versioned'

const TABLE = 'jobs'

export function listJobs() {
  return supabase.from(TABLE).select('*').order('updated_at', { ascending: false })
}

export function saveJobRecord(editing: Job | 'new', payload: object, userId: string): Promise<SaveResult<Job>> {
  return saveVersioned<Job>(TABLE, editing, payload, userId)
}

/** Updates a job at the version the user was looking at and returns the stored row. */
export function updateJobReturningRow(job: Job, payload: object) {
  return supabase.from(TABLE).update(payload).eq('id', job.id).eq('version', job.version).select('*').maybeSingle()
}

/** Updates a job at the version the user was looking at; returns only whether the lock matched. */
export function updateJobLocked(job: Pick<Job, 'id' | 'version'>, payload: object) {
  return supabase.from(TABLE).update(payload).eq('id', job.id).eq('version', job.version).select('id').maybeSingle()
}

/** Updates a job at a known version and returns the new version, for the send flow. */
export function updateJobVersioned(job: Job, payload: object) {
  return supabase.from(TABLE).update(payload).eq('id', job.id).eq('version', job.version).select('id, version').maybeSingle()
}

export function readJobVersion(id: string) {
  return supabase.from(TABLE).select('version').eq('id', id).maybeSingle()
}

export function linkJobCV(job: Pick<Job, 'id' | 'version'>, cvId: string | null) {
  return updateJobLocked(job, { cv_id: cvId })
}

export function deleteJobRow(job: Job) {
  return supabase.from(TABLE).delete().eq('id', job.id)
}

export function insertJobRow(userId: string, payload: object) {
  return supabase.from(TABLE).insert({ ...payload, user_id: userId }).select('id').maybeSingle()
}

/** Restores a backup: legacy files add new rows, current ones are upserted by id. */
export function importJobRows(rows: object[], isLegacyBackup: boolean) {
  return isLegacyBackup
    ? supabase.from(TABLE).insert(rows)
    : supabase.from(TABLE).upsert(rows, { onConflict: 'id' })
}
