import { describe, expect, it } from 'vitest'
import { findThreadReplies, headerValue, matchLostSend, normalizeAddress } from './gmailReplies'
import type { GmailMessageMetadata } from './google'

function message(id: string, headers: Record<string, string>, isoDate: string, threadId = 'thread-1'): GmailMessageMetadata {
  return {
    id,
    threadId,
    internalDate: String(new Date(isoDate).getTime()),
    payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) },
  }
}

const ME = 'me@example.com'

describe('normalizeAddress and headerValue', () => {
  it('extracts a bare address from a display-name header', () => {
    expect(normalizeAddress('Dana Lead <Dana@Example.com>')).toBe('dana@example.com')
    expect(normalizeAddress('  PLAIN@Example.com ')).toBe('plain@example.com')
  })

  it('reads headers case-insensitively', () => {
    const sample = message('m1', { 'FROM': 'a@b.com', 'subject': 'Hello' }, '2026-08-01T10:00:00Z')
    expect(headerValue(sample, 'From')).toBe('a@b.com')
    expect(headerValue(sample, 'SUBJECT')).toBe('Hello')
    expect(headerValue(sample, 'Missing')).toBe('')
  })
})

describe('findThreadReplies', () => {
  const sentAt = '2026-08-01T10:00:00.000Z'

  it('returns only messages from other people, oldest first', () => {
    const replies = findThreadReplies([
      message('mine', { From: `Me <${ME}>`, Subject: 'Intro' }, '2026-08-01T10:00:00Z'),
      message('later', { From: 'Dana <dana@example.com>', Subject: 'Re: Intro' }, '2026-08-03T09:00:00Z'),
      message('sooner', { From: 'Sam <sam@example.com>', Subject: 'Re: Intro' }, '2026-08-02T09:00:00Z'),
    ], ME, sentAt)

    expect(replies.map((reply) => reply.provider_message_id)).toEqual(['sooner', 'later'])
    expect(replies[0]).toMatchObject({ from_address: 'sam@example.com', thread_id: 'thread-1', subject: 'Re: Intro' })
    expect(replies[0].received_at).toBe('2026-08-02T09:00:00.000Z')
  })

  it('ignores our own follow-ups on the same thread', () => {
    const replies = findThreadReplies([
      message('m1', { From: ME, Subject: 'Intro' }, '2026-08-01T10:00:00Z'),
      message('m2', { From: `Eugene <${ME.toUpperCase()}>`, Subject: 'Following up' }, '2026-08-08T10:00:00Z'),
    ], ME, sentAt)
    expect(replies).toEqual([])
  })

  it('ignores anything meaningfully older than our message', () => {
    const replies = findThreadReplies([
      message('old', { From: 'other@example.com' }, '2026-07-20T10:00:00Z'),
    ], ME, sentAt)
    expect(replies).toEqual([])
  })

  it('tolerates small clock differences around the send time', () => {
    const replies = findThreadReplies([
      message('edge', { From: 'other@example.com' }, '2026-08-01T09:59:30Z'),
    ], ME, sentAt)
    expect(replies).toHaveLength(1)
  })

  it('returns nothing when the send time or dates are unusable', () => {
    expect(findThreadReplies([message('m', { From: 'other@example.com' }, '2026-08-02T10:00:00Z')], ME, 'not-a-date')).toEqual([])
    expect(findThreadReplies([{ id: 'm', payload: { headers: [{ name: 'From', value: 'other@example.com' }] } }], ME, sentAt)).toEqual([])
  })
})

describe('matchLostSend', () => {
  const target = { recipient: 'dana@example.com', subject: 'IT leadership experience', attemptedAtIso: '2026-08-01T10:00:00.000Z' }

  it('finds our message by recipient, subject and time', () => {
    const found = matchLostSend([
      message('other-subject', { To: 'dana@example.com', Subject: 'Something else' }, '2026-08-01T10:00:05Z'),
      message('wanted', { To: 'Dana Lead <dana@example.com>', Subject: 'IT leadership experience' }, '2026-08-01T10:00:05Z'),
    ], target)
    expect(found?.id).toBe('wanted')
  })

  it('rejects a different recipient or an earlier message', () => {
    expect(matchLostSend([
      message('wrong-person', { To: 'someone@else.com', Subject: 'IT leadership experience' }, '2026-08-01T10:00:05Z'),
    ], target)).toBeNull()

    expect(matchLostSend([
      message('too-early', { To: 'dana@example.com', Subject: 'IT leadership experience' }, '2026-08-01T09:00:00Z'),
    ], target)).toBeNull()
  })

  it('picks the earliest match when a subject was reused', () => {
    const found = matchLostSend([
      message('second', { To: 'dana@example.com', Subject: 'IT leadership experience' }, '2026-08-01T12:00:00Z'),
      message('first', { To: 'dana@example.com', Subject: 'IT leadership experience' }, '2026-08-01T10:00:10Z'),
    ], target)
    expect(found?.id).toBe('first')
  })

  it('returns null when nothing matches', () => {
    expect(matchLostSend([], target)).toBeNull()
  })
})
