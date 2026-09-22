import { supabase } from '../lib/supabase'
import type { CV } from '../types'

const TABLE = 'cvs'
const BUCKET = 'cvs'

export function listCVs() {
  return supabase.from(TABLE).select('*').order('updated_at', { ascending: false })
}

/** Inserts a CV with a caller-chosen id, so it can be linked before it is read back. */
export function insertCVRow(userId: string, id: string, payload: object) {
  return supabase.from(TABLE).insert({ id, user_id: userId, data: {}, ...payload })
}

export function insertCVReturningVersion(userId: string, id: string, payload: object) {
  return supabase.from(TABLE).insert({ id, user_id: userId, data: {}, ...payload }).select('id, version').maybeSingle()
}

export function updateCVLocked(cv: CV, payload: object) {
  return supabase.from(TABLE).update(payload).eq('id', cv.id).eq('version', cv.version).select('id, version').maybeSingle()
}

export function readCVVersion(id: string) {
  return supabase.from(TABLE).select('version').eq('id', id).maybeSingle()
}

export function deleteCVRow(cv: CV) {
  return supabase.from(TABLE).delete().eq('id', cv.id).eq('version', cv.version).select('id').maybeSingle()
}

export function uploadCVFile(path: string, file: File, mimeType: string) {
  return supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', contentType: mimeType, upsert: false })
}

export function downloadCVFile(path: string) {
  return supabase.storage.from(BUCKET).download(path)
}

export function removeCVFile(path: string) {
  return supabase.storage.from(BUCKET).remove([path])
}
