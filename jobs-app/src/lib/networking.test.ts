import { describe, expect, it } from 'vitest'
import {
  contactDraftToPayload,
  contactMatches,
  interactionDraftToPayload,
  lastInteractionByContact,
  likelyInterviewTopics,
  prepDraftToPayload,
  rankStarStories,
  starStoryDraftToPayload,
} from './networking'
import { EMPTY_CONTACT, EMPTY_STAR_STORY, type Contact, type ContactInteraction, type StarStory } from '../types'

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: 'contact-1',
    user_id: 'user-1',
    name: 'Dana Recruiter',
    company: null,
    role_title: null,
    email: null,
    phone: null,
    linkedin_url: null,
    relationship: 'recruiter',
    pipeline_stage: 'contacted',
    job_id: null,
    next_action: null,
    next_action_at: null,
    notes: null,
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    version: 1,
    data: {},
    ...overrides,
  }
}

function story(overrides: Partial<StarStory>): StarStory {
  return {
    id: 'story-1',
    user_id: 'user-1',
    title: 'Untitled',
    situation: null,
    task: null,
    action: null,
    result: null,
    skills: null,
    notes: null,
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    version: 1,
    data: {},
    ...overrides,
  }
}

describe('contactDraftToPayload', () => {
  it('trims text and converts empty optional fields to null', () => {
    const payload = contactDraftToPayload({
      ...EMPTY_CONTACT,
      name: '  Dana Recruiter  ',
      company: '   ',
      email: ' dana@agency.example ',
      job_id: '',
    })
    expect(payload.name).toBe('Dana Recruiter')
    expect(payload.company).toBeNull()
    expect(payload.email).toBe('dana@agency.example')
    expect(payload.job_id).toBeNull()
    expect(payload.next_action_at).toBeNull()
  })

  it('converts the local next action time to an ISO timestamp', () => {
    const payload = contactDraftToPayload({ ...EMPTY_CONTACT, name: 'Dana', next_action_at: '2026-08-10T09:30' })
    expect(payload.next_action_at).toBe(new Date('2026-08-10T09:30').toISOString())
  })
})

describe('interactionDraftToPayload', () => {
  it('keeps the provided time and trims the summary', () => {
    const payload = interactionDraftToPayload({ occurred_at: '2026-08-03T14:00', channel: 'call', summary: '  Spoke about the platform role.  ' }, 'contact-9')
    expect(payload.contact_id).toBe('contact-9')
    expect(payload.channel).toBe('call')
    expect(payload.summary).toBe('Spoke about the platform role.')
    expect(payload.occurred_at).toBe(new Date('2026-08-03T14:00').toISOString())
  })
})

describe('contactMatches', () => {
  const dana = contact({ name: 'Dana Recruiter', company: 'TalentCo', notes: 'Met at PyData' })

  it('matches by name, company, and notes case-insensitively', () => {
    expect(contactMatches(dana, 'talentco', 'all')).toBe(true)
    expect(contactMatches(dana, 'pydata', 'all')).toBe(true)
    expect(contactMatches(dana, 'unknown', 'all')).toBe(false)
  })

  it('filters by pipeline stage', () => {
    expect(contactMatches(dana, '', 'contacted')).toBe(true)
    expect(contactMatches(dana, '', 'dormant')).toBe(false)
  })
})

describe('lastInteractionByContact', () => {
  it('keeps the most recent interaction per contact', () => {
    const interactions = [
      { contact_id: 'a', occurred_at: '2026-08-01T10:00:00.000Z' },
      { contact_id: 'a', occurred_at: '2026-08-03T10:00:00.000Z' },
      { contact_id: 'b', occurred_at: '2026-07-20T10:00:00.000Z' },
    ] as ContactInteraction[]
    const latest = lastInteractionByContact(interactions)
    expect(latest.get('a')).toBe('2026-08-03T10:00:00.000Z')
    expect(latest.get('b')).toBe('2026-07-20T10:00:00.000Z')
  })
})

describe('likelyInterviewTopics', () => {
  it('returns the most frequent meaningful keywords first', () => {
    const topics = likelyInterviewTopics('Kubernetes and Terraform. Kubernetes experience is required. Terraform and Kubernetes daily.', 2)
    expect(topics[0]).toBe('kubernetes')
    expect(topics[1]).toBe('terraform')
  })

  it('returns an empty list without a job description', () => {
    expect(likelyInterviewTopics(null)).toEqual([])
    expect(likelyInterviewTopics('   ')).toEqual([])
  })
})

describe('rankStarStories', () => {
  it('ranks stories that share keywords with the job description higher', () => {
    const migration = story({ id: 's1', title: 'Database migration rescue', situation: 'A Postgres migration was failing in production.', skills: 'Postgres, SQL' })
    const teamwork = story({ id: 's2', title: 'Onboarding buddies', situation: 'New starters struggled with onboarding.' })
    const ranked = rankStarStories([teamwork, migration], 'We need Postgres and SQL migration experience in production.')
    expect(ranked[0]?.story.id).toBe('s1')
    expect(ranked[0]?.score).toBeGreaterThan(0)
  })

  it('returns nothing without a job description', () => {
    expect(rankStarStories([story({})], null)).toEqual([])
  })
})

describe('starStoryDraftToPayload', () => {
  it('requires only the title and nulls empty sections', () => {
    const payload = starStoryDraftToPayload({ ...EMPTY_STAR_STORY, title: ' Fixed the deploy ' })
    expect(payload.title).toBe('Fixed the deploy')
    expect(payload.situation).toBeNull()
    expect(payload.result).toBeNull()
  })
})

describe('prepDraftToPayload', () => {
  it('keeps only completed checklist items and nulls empty notes', () => {
    const payload = prepDraftToPayload({
      research_notes: '  ',
      questions_to_ask: 'What does success look like in 6 months?',
      checklist: { research_company: true, questions: false, salary: true },
      post_interview_notes: '',
    })
    expect(payload.research_notes).toBeNull()
    expect(payload.questions_to_ask).toBe('What does success look like in 6 months?')
    expect(payload.checklist).toEqual({ research_company: true, salary: true })
    expect(payload.post_interview_notes).toBeNull()
  })
})
