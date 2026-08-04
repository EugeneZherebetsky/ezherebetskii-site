import {
  CONTACT_RELATIONSHIPS,
  CONTACT_STAGES,
  type Contact,
  type ContactDraft,
  type ContactRelationship,
  type ContactStage,
  type InteractionDraft,
  type InterviewPrep,
  type InterviewPrepDraft,
  type JobStatus,
  type StarStory,
  type StarStoryDraft,
} from '../types'
import { clean, toLocalDateTimeInput } from './opportunities'
import { matchCV, topKeywords } from './tailoring'

export const INTERVIEW_STAGE_STATUSES: JobStatus[] = ['phone_screen', 'interviewing', 'assessment', 'final_round']

export function isContactRelationship(value: unknown): value is ContactRelationship {
  return typeof value === 'string' && CONTACT_RELATIONSHIPS.includes(value as ContactRelationship)
}

export function isContactStage(value: unknown): value is ContactStage {
  return typeof value === 'string' && CONTACT_STAGES.includes(value as ContactStage)
}

export function contactToDraft(contact: Contact): ContactDraft {
  return {
    name: contact.name,
    company: contact.company ?? '',
    role_title: contact.role_title ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    linkedin_url: contact.linkedin_url ?? '',
    relationship: contact.relationship,
    pipeline_stage: contact.pipeline_stage,
    job_id: contact.job_id ?? '',
    next_action: contact.next_action ?? '',
    next_action_at: toLocalDateTimeInput(contact.next_action_at),
    notes: contact.notes ?? '',
  }
}

export function contactDraftToPayload(draft: ContactDraft) {
  return {
    name: draft.name.trim(),
    company: clean(draft.company),
    role_title: clean(draft.role_title),
    email: clean(draft.email),
    phone: clean(draft.phone),
    linkedin_url: clean(draft.linkedin_url),
    relationship: draft.relationship,
    pipeline_stage: draft.pipeline_stage,
    job_id: clean(draft.job_id),
    next_action: clean(draft.next_action),
    next_action_at: draft.next_action_at ? new Date(draft.next_action_at).toISOString() : null,
    notes: clean(draft.notes),
  }
}

export function interactionDraftToPayload(draft: InteractionDraft, contactId: string) {
  return {
    contact_id: contactId,
    occurred_at: draft.occurred_at ? new Date(draft.occurred_at).toISOString() : new Date().toISOString(),
    channel: draft.channel,
    summary: draft.summary.trim(),
  }
}

export function starStoryToDraft(story: StarStory): StarStoryDraft {
  return {
    title: story.title,
    situation: story.situation ?? '',
    task: story.task ?? '',
    action: story.action ?? '',
    result: story.result ?? '',
    skills: story.skills ?? '',
    notes: story.notes ?? '',
  }
}

export function starStoryDraftToPayload(draft: StarStoryDraft) {
  return {
    title: draft.title.trim(),
    situation: clean(draft.situation),
    task: clean(draft.task),
    action: clean(draft.action),
    result: clean(draft.result),
    skills: clean(draft.skills),
    notes: clean(draft.notes),
  }
}

export function prepToDraft(prep: InterviewPrep | null): InterviewPrepDraft {
  return {
    research_notes: prep?.research_notes ?? '',
    questions_to_ask: prep?.questions_to_ask ?? '',
    checklist: { ...(prep?.checklist ?? {}) },
    post_interview_notes: prep?.post_interview_notes ?? '',
  }
}

export function prepDraftToPayload(draft: InterviewPrepDraft) {
  const checklist: Record<string, boolean> = {}
  Object.entries(draft.checklist).forEach(([key, done]) => {
    if (done) checklist[key] = true
  })
  return {
    research_notes: clean(draft.research_notes),
    questions_to_ask: clean(draft.questions_to_ask),
    checklist,
    post_interview_notes: clean(draft.post_interview_notes),
  }
}

export function contactMatches(contact: Contact, search: string, stage: 'all' | ContactStage) {
  const needle = search.trim().toLowerCase()
  const matchesStage = stage === 'all' || contact.pipeline_stage === stage
  const matchesSearch = !needle || [
    contact.name,
    contact.company ?? '',
    contact.role_title ?? '',
    contact.email ?? '',
    contact.notes ?? '',
  ].some((value) => value.toLowerCase().includes(needle))
  return matchesStage && matchesSearch
}

export function likelyInterviewTopics(jobDescription: string | null, limit = 12): string[] {
  if (!jobDescription?.trim()) return []
  return topKeywords(jobDescription, limit)
}

export function starStorySearchText(story: StarStory) {
  return [story.title, story.situation, story.task, story.action, story.result, story.skills, story.notes]
    .filter(Boolean)
    .join('\n')
}

export function rankStarStories(stories: StarStory[], jobDescription: string | null) {
  if (!jobDescription?.trim()) return []
  return stories
    .map((story) => ({ story, score: matchCV(starStorySearchText(story), jobDescription).score }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.story.title.localeCompare(right.story.title))
}
