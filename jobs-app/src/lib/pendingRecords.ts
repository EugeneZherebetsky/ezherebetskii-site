import type { ApplicationSend } from '../types'

/**
 * Records for messages that were accepted by Gmail but whose database row was
 * not updated. They are kept per browser so a retry records the same message
 * instead of sending a second one.
 */

const PENDING_SEND_PREFIX = 'opportunity-desk:pending-gmail-history:'
const PENDING_OUTREACH_PREFIX = 'opportunity-desk:pending-outreach-record:'

export type PendingOutreachRecord = {
  outreach_id: string
  provider_message_id: string
  provider_thread_id: string | null
  attachment_filename: string | null
  sent_at: string
}

function readStored<T>(key: string, isValid: (value: Partial<T>) => boolean): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<T>
    return isValid(parsed) ? (parsed as T) : null
  }
  catch {
    return null
  }
}

/** Writing may fail in private modes; the in-memory retry stays available. */
export function storePending(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export function clearPending(key: string) {
  try {
    localStorage.removeItem(key)
  }
  catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export function pendingSendKey(userId: string) {
  return `${PENDING_SEND_PREFIX}${userId}`
}

export function pendingOutreachKey(userId: string) {
  return `${PENDING_OUTREACH_PREFIX}${userId}`
}

export function readPendingSend(userId: string): ApplicationSend | null {
  return readStored<ApplicationSend>(pendingSendKey(userId), (parsed) =>
    parsed.user_id === userId
    && parsed.status === 'sent'
    && parsed.provider === 'gmail'
    && Boolean(parsed.id && parsed.job_id && parsed.provider_message_id && parsed.recipient && parsed.subject && parsed.sent_at && parsed.details)
    && typeof parsed.details === 'object')
}

export function readPendingOutreach(userId: string): PendingOutreachRecord | null {
  return readStored<PendingOutreachRecord>(pendingOutreachKey(userId), (parsed) =>
    Boolean(parsed.outreach_id && parsed.provider_message_id && parsed.sent_at))
}
