import { describe, expect, it } from 'vitest'
import {
  dueOutreachFollowUps,
  followUpDateInput,
  hasUnfilledPlaceholder,
  outreachDraftToPayload,
  outreachMatches,
  outreachSummary,
  suggestedOutreach,
} from './outreach'
import { EMPTY_OUTREACH, type OutreachEmail } from '../types'

function email(overrides: Partial<OutreachEmail>): OutreachEmail {
  return {
    id: 'outreach-1',
    user_id: 'user-1',
    company: 'Calderys',
    recipient_name: 'Dana Lead',
    recipient_role: 'IT Director',
    recipient_email: 'dana@example.com',
    contact_id: null,
    cv_id: null,
    job_id: null,
    subject: 'IT leadership experience',
    body: 'Dear Dana,',
    status: 'sent',
    sent_at: '2026-08-01T10:00:00.000Z',
    send_attempt_id: null,
    send_attempted_at: null,
    provider: 'gmail',
    provider_message_id: 'msg-1',
    provider_thread_id: 'thread-1',
    attachment_filename: null,
    reply_status: 'awaiting',
    replied_at: null,
    follow_up_at: null,
    notes: null,
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    version: 1,
    data: {},
    ...overrides,
  }
}

describe('outreachDraftToPayload', () => {
  it('trims identifying fields and nulls empty optional links', () => {
    const payload = outreachDraftToPayload({
      ...EMPTY_OUTREACH,
      company: '  Calderys  ',
      recipient_email: ' dana@example.com ',
      subject: '  Hello  ',
      contact_id: '',
      cv_id: '',
    })
    expect(payload.company).toBe('Calderys')
    expect(payload.recipient_email).toBe('dana@example.com')
    expect(payload.subject).toBe('Hello')
    expect(payload.contact_id).toBeNull()
    expect(payload.cv_id).toBeNull()
    expect(payload.follow_up_at).toBeNull()
  })

  it('preserves the body exactly, including leading and trailing whitespace', () => {
    const body = '\nDear Dana,\n\n  Indented line.\n\n'
    expect(outreachDraftToPayload({ ...EMPTY_OUTREACH, body }).body).toBe(body)
  })

  it('converts a local follow-up time to an ISO timestamp', () => {
    const payload = outreachDraftToPayload({ ...EMPTY_OUTREACH, follow_up_at: '2026-08-10T09:00' })
    expect(payload.follow_up_at).toBe(new Date('2026-08-10T09:00').toISOString())
  })
})

describe('followUpDateInput', () => {
  it('proposes a morning slot the given number of days ahead', () => {
    expect(followUpDateInput(6, new Date('2026-08-04T15:20:00'))).toBe('2026-08-10T09:00')
  })
})

describe('outreachMatches', () => {
  const sent = email({ company: 'Calderys', body: 'Kiln refractory experience' })

  it('searches company, person, subject and body', () => {
    expect(outreachMatches(sent, 'calderys', 'all')).toBe(true)
    expect(outreachMatches(sent, 'refractory', 'all')).toBe(true)
    expect(outreachMatches(sent, 'unrelated', 'all')).toBe(false)
  })

  it('filters drafts separately from reply state', () => {
    const draft = email({ status: 'draft', sent_at: null })
    expect(outreachMatches(draft, '', 'draft')).toBe(true)
    expect(outreachMatches(draft, '', 'awaiting')).toBe(false)
    expect(outreachMatches(sent, '', 'awaiting')).toBe(true)
    expect(outreachMatches(email({ reply_status: 'replied' }), '', 'replied')).toBe(true)
  })

  it('surfaces an unresolved send attempt under its own filter only', () => {
    const inFlight = email({ status: 'sending', sent_at: null, send_attempt_id: 'a', send_attempted_at: '2026-08-02T10:00:00.000Z' })
    expect(outreachMatches(inFlight, '', 'sending')).toBe(true)
    expect(outreachMatches(inFlight, '', 'all')).toBe(true)
    expect(outreachMatches(inFlight, '', 'draft')).toBe(false)
    expect(outreachMatches(inFlight, '', 'awaiting')).toBe(false)
  })
})

describe('outreachSummary', () => {
  it('counts by state and reports distinct companies contacted', () => {
    const summary = outreachSummary([
      email({ id: 'a', company: 'Calderys' }),
      email({ id: 'b', company: 'calderys ', reply_status: 'replied' }),
      email({ id: 'c', company: 'Other Co', reply_status: 'no_reply' }),
      email({ id: 'd', status: 'draft', sent_at: null, company: 'Never Sent' }),
      email({ id: 'e', status: 'sending', sent_at: null, company: 'Unknown Co', send_attempt_id: 'attempt-1', send_attempted_at: '2026-08-02T10:00:00.000Z' }),
    ])
    expect(summary).toEqual({ drafts: 1, unknown: 1, sent: 3, awaiting: 1, replied: 1, noReply: 1, companies: 2 })
  })

  it('never counts an unresolved attempt as sent', () => {
    const summary = outreachSummary([email({ status: 'sending', sent_at: null, send_attempt_id: 'a', send_attempted_at: '2026-08-02T10:00:00.000Z' })])
    expect(summary.sent).toBe(0)
    expect(summary.unknown).toBe(1)
    expect(summary.companies).toBe(0)
  })
})

describe('dueOutreachFollowUps', () => {
  it('lists unanswered sent messages soonest first and drops replied ones', () => {
    const due = dueOutreachFollowUps([
      email({ id: 'later', follow_up_at: '2026-08-20T09:00:00.000Z' }),
      email({ id: 'sooner', follow_up_at: '2026-08-10T09:00:00.000Z' }),
      email({ id: 'answered', follow_up_at: '2026-08-05T09:00:00.000Z', reply_status: 'replied' }),
      email({ id: 'unscheduled', follow_up_at: null }),
      email({ id: 'draft', status: 'draft', sent_at: null, follow_up_at: '2026-08-01T09:00:00.000Z' }),
      email({ id: 'in-flight', status: 'sending', sent_at: null, send_attempt_id: 'a', send_attempted_at: '2026-08-02T10:00:00.000Z', follow_up_at: '2026-08-02T09:00:00.000Z' }),
    ])
    expect(due.map((item) => item.id)).toEqual(['sooner', 'later'])
  })
})

describe('suggestedOutreach', () => {
  it('greets by first name and names the company', () => {
    const { subject, body } = suggestedOutreach('Calderys', 'Dana Lead')
    expect(subject).toContain('Calderys')
    expect(body).toContain('Dear Dana,')
    expect(body).toContain('why Calderys specifically')
  })

  it('falls back to a neutral greeting without a name', () => {
    expect(suggestedOutreach('Calderys', '').body).toContain('Dear Sir or Madam,')
  })

  it('leaves placeholders that the sender must replace', () => {
    expect(hasUnfilledPlaceholder(suggestedOutreach('Calderys', 'Dana').body)).toBe(true)
    expect(hasUnfilledPlaceholder('Dear Dana,\n\nA finished message with no gaps.')).toBe(false)
  })
})
