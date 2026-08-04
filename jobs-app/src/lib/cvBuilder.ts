import {
  CV_BLOCK_TYPE_ORDER,
  type CVBlock,
  type CVBlockDraft,
  type CVBlockType,
  type StarStory,
} from '../types'
import { clean } from './opportunities'
import { starStorySearchText } from './networking'
import { tokens, topKeywords } from './tailoring'

const SECTION_HEADINGS: Record<CVBlockType, string> = {
  summary: 'PROFESSIONAL SUMMARY',
  skills: 'SKILLS',
  experience: 'EXPERIENCE',
  achievement: 'SELECTED ACHIEVEMENTS',
  education: 'EDUCATION',
  certification: 'CERTIFICATIONS',
  other: 'ADDITIONAL',
}

/** A block or story offered to the builder, with why it was offered. */
export type BuilderItem = {
  kind: 'block' | 'story'
  id: string
  title: string
  blockType: CVBlockType
  /** Text used when this item is assembled into the CV. */
  text: string
  /** Requirement keywords this item actually contains. */
  matched: string[]
}

export function blockToDraft(block: CVBlock): CVBlockDraft {
  return {
    block_type: block.block_type,
    title: block.title,
    content: block.content,
    tags: block.tags ?? '',
    sort_order: block.sort_order,
  }
}

export function blockDraftToPayload(draft: CVBlockDraft) {
  return {
    block_type: draft.block_type,
    title: draft.title.trim(),
    content: draft.content.trim(),
    tags: clean(draft.tags),
    sort_order: Number.isFinite(draft.sort_order) ? draft.sort_order : 0,
  }
}

/** The keywords a role description asks for, most frequent first. */
export function roleRequirements(jobDescription: string | null, limit = 20): string[] {
  if (!jobDescription?.trim()) return []
  return topKeywords(jobDescription, limit)
}

function firstSentence(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/)
  return (match ? match[0] : trimmed).trim().replace(/[.\s]+$/, '')
}

/**
 * Compresses a STAR story into a CV bullet using only the story's own
 * sentences. Nothing is generated: the bullet is the opening of the action
 * and, when present, the opening of the result. A story with no action falls
 * back to its title so the item is never silently empty.
 */
export function storyBullet(story: StarStory): string {
  const action = firstSentence(story.action ?? '')
  const result = firstSentence(story.result ?? '')
  if (action && result) return `${action} — ${result}.`
  if (action) return `${action}.`
  if (result) return `${result}.`
  return story.title.trim()
}

function matchedRequirements(text: string, requirements: string[]): string[] {
  if (!requirements.length) return []
  const present = new Set(tokens(text))
  return requirements.filter((requirement) => present.has(requirement))
}

/**
 * Every block and story that could go into the CV, ranked by how many of the
 * role's requirements it actually contains. Ranking is transparent: the
 * matched keywords are returned so the interface can show why an item ranks
 * where it does. Stories are matched on their full STAR text but assembled as
 * a bullet.
 */
export function buildCandidates(blocks: CVBlock[], stories: StarStory[], jobDescription: string | null): BuilderItem[] {
  const requirements = roleRequirements(jobDescription)
  const blockItems: BuilderItem[] = blocks.map((block) => ({
    kind: 'block',
    id: block.id,
    title: block.title,
    blockType: block.block_type,
    text: block.content,
    matched: matchedRequirements(`${block.title}\n${block.content}\n${block.tags ?? ''}`, requirements),
  }))
  const storyItems: BuilderItem[] = stories.map((story) => ({
    kind: 'story',
    id: story.id,
    title: story.title,
    blockType: 'achievement',
    text: storyBullet(story),
    matched: matchedRequirements(starStorySearchText(story), requirements),
  }))
  return [...blockItems, ...storyItems].sort((left, right) =>
    right.matched.length - left.matched.length
    || left.title.localeCompare(right.title))
}

/** Groups selected items into CV sections, preserving the given order within each. */
export function assembleCVText(items: BuilderItem[]): string {
  const sections: string[] = []
  CV_BLOCK_TYPE_ORDER.forEach((blockType) => {
    const inSection = items.filter((item) => item.blockType === blockType && item.text.trim())
    if (!inSection.length) return
    const lines = inSection.map((item) => (
      item.kind === 'story' || blockType === 'achievement'
        ? `• ${item.text.trim()}`
        : item.text.trim()
    ))
    sections.push([SECTION_HEADINGS[blockType], ...lines].join('\n'))
  })
  return sections.join('\n\n').trim()
}

export type CoverageReport = {
  covered: string[]
  missing: string[]
  requirements: string[]
}

/**
 * Which of the role's requirements the current selection actually evidences.
 * Missing keywords are a prompt to add a block, never a score: a real CV can
 * be strong while missing a term the advert happened to repeat.
 */
export function coverageReport(items: BuilderItem[], jobDescription: string | null): CoverageReport {
  const requirements = roleRequirements(jobDescription)
  if (!requirements.length) return { covered: [], missing: [], requirements }
  const selectedText = items.map((item) => item.text).join('\n')
  const present = new Set(matchedRequirements(selectedText, requirements))
  return {
    covered: requirements.filter((requirement) => present.has(requirement)),
    missing: requirements.filter((requirement) => !present.has(requirement)),
    requirements,
  }
}
