import { supabase } from '../lib/supabase'
import type { InterviewPrep } from '../types'

const TABLE = 'interview_preps'

export function listInterviewPreps() {
  return supabase.from(TABLE).select('*')
}

export function updateInterviewPrep(prep: InterviewPrep, payload: object) {
  return supabase.from(TABLE).update(payload).eq('id', prep.id).eq('version', prep.version).select('*').maybeSingle()
}

export function readInterviewPrep(id: string) {
  return supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
}

export function readInterviewPrepForJob(jobId: string) {
  return supabase.from(TABLE).select('*').eq('job_id', jobId).maybeSingle()
}

export function insertInterviewPrep(userId: string, jobId: string, payload: object) {
  return supabase.from(TABLE).insert({ ...payload, user_id: userId, job_id: jobId }).select('*').maybeSingle()
}
