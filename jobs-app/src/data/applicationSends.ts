import { supabase } from '../lib/supabase'
import type { ApplicationSend } from '../types'

const TABLE = 'application_sends'

export function listApplicationSends() {
  return supabase.from(TABLE).select('*').order('sent_at', { ascending: false }).limit(500)
}

export function insertApplicationSend(record: ApplicationSend) {
  return supabase.from(TABLE).insert(record)
}

export function insertFailedSend(row: object) {
  return supabase.from(TABLE).insert(row)
}

export function readApplicationSend(id: string, userId: string) {
  return supabase.from(TABLE).select('id, provider_message_id').eq('id', id).eq('user_id', userId).maybeSingle()
}
