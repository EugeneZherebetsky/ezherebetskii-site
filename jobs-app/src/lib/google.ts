import type { JobDraft } from '../types'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  // Headers and labels only. This scope cannot read message bodies, which is
  // enough to see that a thread was answered and by whom, and to find a
  // message whose send response was lost.
  'https://www.googleapis.com/auth/gmail.metadata',
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

let googleToken: { userId: string; clientId: string; accessToken: string; expiresAt: number } | null = null
let googleAccessGeneration = 0

export function validGoogleClientId(value: string) {
  return GOOGLE_CLIENT_ID_PATTERN.test(value.trim())
}

export function hasGoogleAccess(userId: string, clientId: string | null | undefined) {
  return Boolean(userId && clientId && googleToken?.userId === userId && googleToken.clientId === clientId && googleToken.expiresAt > Date.now() + 60_000)
}

export function clearGoogleAccess() {
  googleToken = null
  googleAccessGeneration += 1
}

export function requestGoogleAccess(userId: string, clientId: string) {
  if (!userId) return Promise.reject(new Error('Sign in to Opportunity Desk before connecting Google.'))
  const normalizedClientId = clientId.trim()
  if (!validGoogleClientId(normalizedClientId)) {
    return Promise.reject(new Error('Add a valid Google OAuth client ID in Settings first.'))
  }
  if (hasGoogleAccess(userId, normalizedClientId)) return Promise.resolve(googleToken!.accessToken)

  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) return Promise.reject(new Error('Google authorization is still loading. Wait a moment and try again.'))

  return new Promise<string>((resolve, reject) => {
    const requestGeneration = googleAccessGeneration
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
        if (requestGeneration !== googleAccessGeneration) {
          reject(new Error('Your Opportunity Desk session changed. Connect Google again.'))
          return
        }
        if (!response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google authorization was cancelled.'))
          return
        }
        if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(response, ...GOOGLE_SCOPES)) {
          reject(new Error('Calendar and Gmail permissions are both required for this connection.'))
          return
        }
        googleToken = {
          userId,
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

/**
 * An error built from an actual HTTP response, which proves the request
 * reached Google and was refused. A transport failure produces an ordinary
 * error instead, and cannot prove whether the request was carried out.
 */
export class GoogleResponseError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoogleResponseError'
    this.status = status
  }
}

/** True when Google answered at all, whatever the status. */
export function isGoogleRefusal(error: unknown): error is GoogleResponseError {
  return error instanceof GoogleResponseError
}

/**
 * True only when Google rejected the request outright, so it certainly did not
 * take effect.
 *
 * A 5xx is not such a case: Gmail can fail on its own side after accepting a
 * message, so treating one as a refusal would invite a duplicate send. A 408
 * is excluded for the same reason. Everything else in the 4xx range is a
 * terminal client error, where nothing was delivered.
 */
export function isTerminalClientError(error: unknown): error is GoogleResponseError {
  if (!(error instanceof GoogleResponseError)) return false
  return error.status >= 400 && error.status < 500 && error.status !== 408
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
  return new GoogleResponseError(`${service} returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`, response.status)
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

export type GmailHeader = { name?: string; value?: string }

export type GmailMessageMetadata = {
  id: string
  threadId?: string
  internalDate?: string
  labelIds?: string[]
  payload?: { headers?: GmailHeader[] }
}

/** The signed-in mailbox address, needed to tell a reply from our own message. */
export async function fetchGmailAddress(accessToken: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw await googleApiError(response, 'Gmail')
  const profile = await response.json() as { emailAddress?: string }
  return profile.emailAddress ?? ''
}

/**
 * Every message on one thread, headers only. `format=metadata` is the most
 * this app is permitted to read: subjects, addresses and dates, never bodies.
 */
export async function fetchGmailThread(accessToken: string, threadId: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}`)
  url.searchParams.set('format', 'metadata')
  for (const header of ['From', 'To', 'Subject', 'Date', 'Message-ID']) {
    url.searchParams.append('metadataHeaders', header)
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (response.status === 404) return null
  if (!response.ok) throw await googleApiError(response, 'Gmail')
  const thread = await response.json() as { id: string; messages?: GmailMessageMetadata[] }
  return thread
}

/**
 * Recent messages in the Sent label, newest first. Used to find a message
 * whose send response was lost. `labelIds` is used rather than a search query
 * because the metadata scope does not permit queries.
 */
export async function fetchRecentSentMessages(accessToken: string, maxResults = 25) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  url.searchParams.set('labelIds', 'SENT')
  url.searchParams.set('maxResults', String(maxResults))
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw await googleApiError(response, 'Gmail')
  const listing = await response.json() as { messages?: Array<{ id: string; threadId?: string }> }
  const ids = (listing.messages ?? []).map((message) => message.id)

  const details: GmailMessageMetadata[] = []
  for (const id of ids) {
    const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`)
    messageUrl.searchParams.set('format', 'metadata')
    for (const header of ['To', 'Subject', 'Date', 'Message-ID']) {
      messageUrl.searchParams.append('metadataHeaders', header)
    }
    const messageResponse = await fetch(messageUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!messageResponse.ok) throw await googleApiError(messageResponse, 'Gmail')
    details.push(await messageResponse.json() as GmailMessageMetadata)
  }
  return details
}
