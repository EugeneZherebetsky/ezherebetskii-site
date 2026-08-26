import type { GmailMessageMetadata } from './google'

/**
 * A message on one of our threads that came from somebody else. Only header
 * facts are ever held: who, when, and the subject. Bodies are neither
 * requested nor stored.
 */
export type DetectedReply = {
  provider_message_id: string
  thread_id: string
  from_address: string
  subject: string
  received_at: string
}

export function headerValue(message: GmailMessageMetadata, name: string) {
  const wanted = name.toLowerCase()
  const header = message.payload?.headers?.find((candidate) => candidate.name?.toLowerCase() === wanted)
  return header?.value ?? ''
}

/** Reduces `Dana Lead <dana@example.com>` to `dana@example.com`. */
export function normalizeAddress(value: string) {
  const angled = value.match(/<([^>]+)>/)
  return (angled ? angled[1] : value).trim().toLowerCase()
}

function receivedAt(message: GmailMessageMetadata) {
  const epoch = Number(message.internalDate)
  return Number.isFinite(epoch) ? epoch : null
}

/**
 * Messages on the thread that somebody else sent at or after our own message.
 * A minute of tolerance absorbs clock differences between our recorded send
 * time and Gmail's, without reaching back to unrelated earlier mail.
 */
export function findThreadReplies(
  messages: GmailMessageMetadata[],
  ourAddress: string,
  sentAtIso: string,
): DetectedReply[] {
  const ours = normalizeAddress(ourAddress)
  const sentAt = new Date(sentAtIso).getTime()
  if (!Number.isFinite(sentAt)) return []

  return messages
    .map((message) => ({ message, at: receivedAt(message) }))
    .filter((entry): entry is { message: GmailMessageMetadata; at: number } => entry.at !== null)
    .filter(({ message, at }) => {
      const from = normalizeAddress(headerValue(message, 'From'))
      if (!from || (ours && from === ours)) return false
      return at >= sentAt - 60_000
    })
    .sort((left, right) => left.at - right.at)
    .map(({ message, at }) => ({
      provider_message_id: message.id,
      thread_id: message.threadId ?? '',
      from_address: normalizeAddress(headerValue(message, 'From')),
      subject: headerValue(message, 'Subject'),
      received_at: new Date(at).toISOString(),
    }))
}

/** Clock tolerance before the attempt, for skew between our clock and Gmail's. */
const LOST_SEND_TOLERANCE_MS = 120_000

/** How long after the attempt a delivery can still plausibly belong to it. */
export const LOST_SEND_WINDOW_MS = 10 * 60_000

/**
 * Finds our own message among recent sent mail, for a send whose response was
 * lost. Matching is on recipient, exact subject, and a send time inside a
 * narrow window around the attempt.
 *
 * The window has an upper bound on purpose. Recipient and subject alone would
 * also match the same message sent by hand hours later, and attaching that
 * message id would permanently record this attempt as the one that was
 * delivered.
 */
export function matchLostSend(
  candidates: GmailMessageMetadata[],
  target: { recipient: string; subject: string; attemptedAtIso: string },
  windowMs = LOST_SEND_WINDOW_MS,
): GmailMessageMetadata | null {
  const wantedTo = normalizeAddress(target.recipient)
  const wantedSubject = target.subject.trim().toLowerCase()
  const attemptedAt = new Date(target.attemptedAtIso).getTime()
  if (!Number.isFinite(attemptedAt)) return null
  const floor = attemptedAt - LOST_SEND_TOLERANCE_MS
  const ceiling = attemptedAt + windowMs

  const matches = candidates.filter((message) => {
    const at = receivedAt(message)
    if (at === null || at < floor || at > ceiling) return false
    if (normalizeAddress(headerValue(message, 'To')) !== wantedTo) return false
    return headerValue(message, 'Subject').trim().toLowerCase() === wantedSubject
  })
  if (!matches.length) return null
  return matches.reduce((earliest, message) => (
    (receivedAt(message) ?? 0) < (receivedAt(earliest) ?? 0) ? message : earliest
  ))
}
