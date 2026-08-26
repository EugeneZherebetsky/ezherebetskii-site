import { describe, expect, it } from 'vitest'
import {
  assembleCVText,
  blockDraftToPayload,
  buildCandidates,
  coverageReport,
  roleRequirements,
  storyBullet,
  type BuilderItem,
} from './cvBuilder'
import { EMPTY_CV_BLOCK, type CVBlock, type StarStory } from '../types'

function block(overrides: Partial<CVBlock>): CVBlock {
  return {
    id: 'block-1',
    user_id: 'user-1',
    block_type: 'achievement',
    title: 'Untitled block',
    content: '',
    tags: null,
    sort_order: 0,
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
    title: 'Untitled story',
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

describe('storyBullet', () => {
  it('joins the opening of the action and the result using only the story text', () => {
    const bullet = storyBullet(story({
      action: 'Broke the estate into dependency-mapped waves. Built a RAID reporting line into steering.',
      result: 'Cutover achieved on schedule. Rated green across quality, cost and time.',
    }))
    expect(bullet).toBe('Broke the estate into dependency-mapped waves — Cutover achieved on schedule.')
  })

  it('falls back through result and title when earlier fields are empty', () => {
    expect(storyBullet(story({ action: 'Merged two support functions' }))).toBe('Merged two support functions.')
    expect(storyBullet(story({ result: 'EUR 250K saved' }))).toBe('EUR 250K saved.')
    expect(storyBullet(story({ title: 'Industry 4.0' }))).toBe('Industry 4.0')
  })

  it('never introduces words that are not in the story', () => {
    const source = story({ action: 'Delivered SCADA integration and robot monitoring.', result: 'Plant ramp-up completed.' })
    const bullet = storyBullet(source)
    const sourceWords = new Set(`${source.action} ${source.result}`.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    const bulletWords = (bullet.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    bulletWords.forEach((word) => expect(sourceWords.has(word)).toBe(true))
  })
})

describe('roleRequirements', () => {
  it('returns nothing without a description', () => {
    expect(roleRequirements(null)).toEqual([])
    expect(roleRequirements('   ')).toEqual([])
  })

  it('surfaces the most repeated meaningful terms', () => {
    const requirements = roleRequirements('Kubernetes and Terraform. Kubernetes required. Kubernetes and Terraform daily.', 2)
    expect(requirements).toEqual(['kubernetes', 'terraform'])
  })
})

describe('buildCandidates', () => {
  const jobDescription = 'We need Kubernetes and Terraform experience. Kubernetes governance matters. Terraform automation is required.'

  it('ranks items by how many role requirements they contain and explains each match', () => {
    const blocks = [
      block({ id: 'b1', block_type: 'skills', title: 'Platform skills', content: 'Kubernetes, Terraform, governance' }),
      block({ id: 'b2', block_type: 'summary', title: 'Summary', content: 'Experienced manager of people' }),
    ]
    const stories = [story({ id: 's1', title: 'Cluster rescue', action: 'Rebuilt the Kubernetes platform.', skills: 'Kubernetes' })]
    const candidates = buildCandidates(blocks, stories, jobDescription)

    expect(candidates[0].id).toBe('b1')
    expect(candidates[0].sortOrder).toBe(0)
    expect(candidates[0].matched).toEqual(expect.arrayContaining(['kubernetes', 'terraform', 'governance']))
    expect(candidates.find((item) => item.id === 's1')?.matched).toContain('kubernetes')
    expect(candidates.find((item) => item.id === 'b2')?.matched).toEqual([])
  })

  it('matches a story on its full STAR text but carries only the bullet into the CV', () => {
    const stories = [story({
      id: 's1',
      title: 'Platform work',
      situation: 'The Terraform estate was unmanaged.',
      action: 'Rebuilt the Kubernetes platform.',
      result: 'Downtime halved.',
    })]
    const [candidate] = buildCandidates([], stories, jobDescription)
    expect(candidate.matched).toEqual(expect.arrayContaining(['kubernetes', 'terraform']))
    expect(candidate.text).toBe('Rebuilt the Kubernetes platform — Downtime halved.')
    expect(candidate.blockType).toBe('achievement')
  })

  it('offers every item even when the role description is empty', () => {
    const candidates = buildCandidates([block({ id: 'b1' })], [story({ id: 's1' })], null)
    expect(candidates).toHaveLength(2)
    candidates.forEach((candidate) => expect(candidate.matched).toEqual([]))
  })
})

describe('assembleCVText', () => {
  const items: BuilderItem[] = [
    { kind: 'story', id: 's1', title: 'Story', blockType: 'achievement', text: 'Led the split — delivered on time.', matched: [], sortOrder: 0 },
    { kind: 'block', id: 'b1', title: 'Summary', blockType: 'summary', text: 'IT leader with twenty years of delivery.', matched: [], sortOrder: 0 },
    { kind: 'block', id: 'b2', title: 'Skills', blockType: 'skills', text: 'Kubernetes, Terraform', matched: [], sortOrder: 0 },
  ]

  it('groups sections in CV order regardless of selection order', () => {
    const text = assembleCVText(items)
    expect(text.indexOf('PROFESSIONAL SUMMARY')).toBeLessThan(text.indexOf('SKILLS'))
    expect(text.indexOf('SKILLS')).toBeLessThan(text.indexOf('SELECTED ACHIEVEMENTS'))
    expect(text).toContain('• Led the split — delivered on time.')
    expect(text).toContain('IT leader with twenty years of delivery.')
  })

  it('omits empty sections and empty items', () => {
    const text = assembleCVText([items[1], { ...items[0], text: '   ' }])
    expect(text).toContain('PROFESSIONAL SUMMARY')
    expect(text).not.toContain('SELECTED ACHIEVEMENTS')
  })

  it('returns an empty string when nothing is selected', () => {
    expect(assembleCVText([])).toBe('')
  })

  it('orders a section by saved block order rather than by how it was ranked', () => {
    const ranked: BuilderItem[] = [
      { kind: 'block', id: 'b1', title: 'Most relevant', blockType: 'skills', text: 'Second line', matched: ['kubernetes'], sortOrder: 20 },
      { kind: 'block', id: 'b2', title: 'Less relevant', blockType: 'skills', text: 'First line', matched: [], sortOrder: 10 },
    ]
    const text = assembleCVText(ranked)
    expect(text.indexOf('First line')).toBeLessThan(text.indexOf('Second line'))
  })

  it('breaks equal order by title so assembly is deterministic', () => {
    const tied: BuilderItem[] = [
      { kind: 'block', id: 'b1', title: 'Zulu', blockType: 'skills', text: 'Zulu line', matched: [], sortOrder: 5 },
      { kind: 'block', id: 'b2', title: 'Alpha', blockType: 'skills', text: 'Alpha line', matched: [], sortOrder: 5 },
    ]
    const text = assembleCVText(tied)
    expect(text.indexOf('Alpha line')).toBeLessThan(text.indexOf('Zulu line'))
  })
})

describe('coverageReport', () => {
  const jobDescription = 'Kubernetes and Terraform. Kubernetes governance. Terraform automation. Mentoring is required.'

  it('separates the requirements the selection evidences from those it does not', () => {
    const selected: BuilderItem[] = [
      { kind: 'block', id: 'b1', title: 'Skills', blockType: 'skills', text: 'Kubernetes and governance', matched: [], sortOrder: 0 },
    ]
    const report = coverageReport(selected, jobDescription)
    expect(report.covered).toContain('kubernetes')
    expect(report.missing).toContain('terraform')
    expect(report.covered).not.toContain('terraform')
    expect([...report.covered, ...report.missing].sort()).toEqual([...report.requirements].sort())
  })

  it('reports nothing to cover without a role description', () => {
    expect(coverageReport([], null)).toEqual({ covered: [], missing: [], requirements: [] })
  })
})

describe('blockDraftToPayload', () => {
  it('trims text and nulls empty tags', () => {
    const payload = blockDraftToPayload({ ...EMPTY_CV_BLOCK, title: '  Skills  ', content: '  Kubernetes  ', tags: '   ' })
    expect(payload.title).toBe('Skills')
    expect(payload.content).toBe('Kubernetes')
    expect(payload.tags).toBeNull()
    expect(payload.sort_order).toBe(0)
  })
})
