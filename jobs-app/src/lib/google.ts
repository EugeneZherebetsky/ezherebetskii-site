import type { JobDraft } from '../types'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
] as const

const GOOGLE_CLIENT_ID_PATTERN = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type GoogleTokenClient = {
  requestAccessToken: () => void
}

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }) => GoogleTokenClient
  hasGrantedAllScopes?: (response: GoogleTokenResponse, ...scopes: string[]) => boolean
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

let googleToken: { clientId: string; accessToken: string; expiresAt: number } | null = null

export function validGoogleClientId(value: string) {
  return GOOGLE_CLIENT_ID_PATTERN.test(value.trim())
}

export function hasGoogleAccess(clientId: string | null | undefined) {
  return Boolean(clientId && googleToken?.clientId === clientId && googleToken.expiresAt > Date.now() + 60_000)
}

export function clearGoogleAccess() {
  googleToken = null
}

export function requestGoogleAccess(clientId: string) {
  const normalizedClientId = clientId.trim()
  if (!validGoogleClientId(normalizedClientId)) {
    return Promise.reject(new Error('Add a valid Google OAuth client ID in Settings first.'))
  }
  if (hasGoogleAccess(normalizedClientId)) return Promise.resolve(googleToken!.accessToken)

  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) return Promise.reject(new Error('Google authorization is still loading. Wait a moment and try again.'))

  return new Promise<string>((resolve, reject) => {
    let settled = false
    let timeout = 0
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      callback()
    }
    timeout = window.setTimeout(() => finish(() => reject(new Error('Google authorization timed out. Please try again.'))), 120_000)
    const tokenClient = oauth2.initTokenClient({
      client_id: normalizedClientId,
      scope: GOOGLE_SCOPES.join(' '),
      callback: (response) => finish(() => {
        if (!response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google authorization was cancelled.'))
          return
        }
        if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(response, ...GOOGLE_SCOPES)) {
          reject(new Error('Calendar and Gmail permissions are both required for this connection.'))
          return
        }
        googleToken = {
          clientId: normalizedClientId,
          accessToken: response.access_token,
          expiresAt: Date.now() + Math.max(60, Number(response.expires_in) || 3600) * 1000,
        }
        resolve(response.access_token)
      }),
      error_callback: (error) => finish(() => reject(new Error(error.message || 'The Google authorization window was closed.'))),
    })
    tokenClient.requestAccessToken()
  })
}

async function googleApiError(response: Response, service: string) {
  let detail = ''
  try {
    const payload = await response.json() as { error?: { message?: unknown } }
    detail = typeof payload.error?.message === 'string' ? payload.error.message : ''
  }
  catch {
    detail = ''
  }
  if (response.status === 401) clearGoogleAccess()
  return new Error(`${service} returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`)
}

export async function createCalendarEvent(accessToken: string, draft: JobDraft, timezone: string) {
  if (!draft.next_action_at) throw new Error('Set a next action date and time first.')
  const startsAt = new Date(draft.next_action_at)
  if (Number.isNaN(startsAt.getTime())) throw new Error('The next action date is invalid.')
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000)
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `${draft.next_action || 'Application follow-up'}: ${draft.role_title} at ${draft.company}`,
      description: [
        `Status: ${draft.status}`,
        draft.contact_name ? `Contact: ${draft.contact_name}` : '',
        draft.job_url,
        'Created by Opportunity Desk',
      ].filter(Boolean).join('\n'),
      start: { dateTime: startsAt.toISOString(), timeZone: timezone || 'UTC' },
      end: { dateTime: endsAt.toISOString(), timeZone: timezone || 'UTC' },
      reminders: { useDefault: true },
    }),
  })
  if (!response.ok) throw await googleApiError(response, 'Google Calendar')
  return await response.json() as { id: string; htmlLink?: string }
}

export type EmailAttachment = {
  filename: string
  mimeType: string
  base64: string
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function utf8Base64(value: string) {
  return bytesToBase64(new TextEncoder().encode(value))
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? ''
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The CV file could not be read.'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const separator = result.indexOf(',')
      if (separator < 0) reject(new Error('The CV file could not be encoded.'))
      else resolve(result.slice(separator + 1))
    }
    reader.readAsDataURL(blob)
  })
}

export function buildRawEmail(to: string, subject: string, body: string, attachment: EmailAttachment | null) {
  const recipient = cleanHeader(to)
  const cleanSubject = cleanHeader(subject)
  const encodedSubject = /[^\x00-\x7F]/.test(cleanSubject) ? `=?UTF-8?B?${utf8Base64(cleanSubject)}?=` : cleanSubject
  const lines = [`To: ${recipient}`, `Subject: ${encodedSubject}`, 'MIME-Version: 1.0']

  if (attachment) {
    const boundary = `opportunity-desk-${crypto.randomUUID()}`
    const filename = cleanHeader(attachment.filename).replace(/["\\]/g, '-') || 'cv-file'
    lines.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(utf8Base64(body)),
      '',
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(attachment.base64),
      '',
      `--${boundary}--`,
    )
  }
  else {
    lines.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrapBase64(utf8Base64(body)))
  }

  return btoa(lines.join('\r\n')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function sendGmailMessage(accessToken: string, raw: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!response.ok) throw await googleApiError(response, 'Gmail')
  return await response.json() as { id: string; threadId?: string }
}
