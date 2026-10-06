import { supabase } from '../lib/supabase'
import type { UserSettings } from '../types'

const TABLE = 'user_settings'

export function readSettings(userId: string) {
  return supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle()
}

export function updateSettings(userId: string, version: number, payload: object) {
  return supabase.from(TABLE).update(payload).eq('user_id', userId).eq('version', version).select('*').maybeSingle()
}

export function upsertSettings(userId: string, payload: object) {
  return supabase.from(TABLE).upsert({ ...payload, user_id: userId }, { onConflict: 'user_id' }).select('*').maybeSingle()
}

export function currentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function defaultSettings(userId: string): UserSettings {
  const now = new Date().toISOString()
  return {
    user_id: userId,
    default_view: 'dashboard',
    reminders_enabled: true,
    reminder_lead_hours: 24,
    timezone: currentTimezone(),
    google_client_id: null,
    email_reminders_enabled: false,
    email_reminder_hour: 8,
    created_at: now,
    updated_at: now,
    version: 1,
  }
}
