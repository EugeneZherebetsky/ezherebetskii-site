import { supabase } from './supabase'
import type { CV, Job } from '../types'

const STOPWORDS = new Set(`a an the and or of to in for with on at by from as is are be this that your you we our will
their they it its he she his her them us i me my role job work team able experience skills required must should
have has had who which what when where can may also other more most into out over under than then these those`.split(/\s+/))

const SHORT_SKILLS = new Set(['ai', 'bi', 'c', 'c#', 'f#', 'go', 'hr', 'ml', 'qa', 'r', 'ui', 'ux'])

export type MatchResult = {
  score: number
  matched: number
  total: number
  missing: string[]
}

export type TailoringResult = {
  summary: string
  bullets: string[]
  cover_letter: string
  keywords_added: string[]
  review_notes: string[]
  model: string
  generation_id: string
}

function tokens(value: string) {
  return (value.toLowerCase().match(/(?:\.[\p{L}][\p{L}\p{N}+#./-]*|[\p{L}\p{N}][\p{L}\p{N}+#./-]*)/gu) ?? [])
    .map((word) => word
      .replace(/^[^\p{L}\p{N}.+#]+/gu, '')
      .replace(/[^\p{L}\p{N}+#]+$/gu, ''))
    .filter((word) => word && !STOPWORDS.has(word) && (word.length >= 3 || SHORT_SKILLS.has(word)))
}

export function matchCV(cvText: string, jobDescription: string): MatchResult {
  const cvTokens = new Set(tokens(cvText))
  const jobTokens = tokens(jobDescription)
  const uniqueJobTokens = new Set(jobTokens)
  let matched = 0
  uniqueJobTokens.forEach((word) => { if (cvTokens.has(word)) matched += 1 })

  const frequency = new Map<string, number>()
  jobTokens.forEach((word) => {
    if (!cvTokens.has(word)) frequency.set(word, (frequency.get(word) ?? 0) + 1)
  })
  const missing = [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 25)
    .map(([word]) => word)

  return {
    score: uniqueJobTokens.size ? Math.round((matched / uniqueJobTokens.size) * 100) : 0,
    matched,
    total: uniqueJobTokens.size,
    missing,
  }
}

export function rankCVs(cvs: CV[], jobDescription: string) {
  return cvs
    .filter((cv) => Boolean(cv.plain_text?.trim()))
    .map((cv) => ({ cv, match: matchCV(cv.plain_text ?? '', jobDescription) }))
    .sort((left, right) => right.match.score - left.match.score || left.cv.name.localeCompare(right.cv.name))
}

function validTailoringResult(value: unknown): value is TailoringResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<TailoringResult>
  return typeof result.summary === 'string'
    && Array.isArray(result.bullets) && result.bullets.every((item) => typeof item === 'string')
    && typeof result.cover_letter === 'string'
    && Array.isArray(result.keywords_added) && result.keywords_added.every((item) => typeof item === 'string')
    && Array.isArray(result.review_notes) && result.review_notes.every((item) => typeof item === 'string')
    && typeof result.model === 'string'
    && typeof result.generation_id === 'string'
}

async function invocationError(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'The AI tailoring service could not be reached.'
  const context = (error as { context?: unknown } | null)?.context
  if (!(context instanceof Response)) return fallback
  try {
    const body = await context.clone().json() as { error?: unknown }
    return typeof body.error === 'string' ? body.error : fallback
  }
  catch {
    return fallback
  }
}

export async function tailorCV(job: Job, cv: CV, jobDescription: string) {
  const { data, error } = await supabase.functions.invoke('tailor-cv', {
    body: {
      jobId: job.id,
      cvId: cv.id,
      jobDescription: jobDescription.trim(),
    },
  })
  if (error) throw new Error(await invocationError(error))
  if (!validTailoringResult(data)) throw new Error('The AI service returned an incomplete tailoring result. Please try again.')
  return data
}

export function tailoredCVText(result: Pick<TailoringResult, 'summary' | 'bullets'>, sourceCVText: string) {
  return [
    'PROFESSIONAL SUMMARY',
    result.summary.trim(),
    '',
    'TAILORED EXPERIENCE HIGHLIGHTS',
    ...result.bullets.map((bullet) => `• ${bullet.trim()}`),
    '',
    'FULL CV',
    sourceCVText.trim(),
  ].join('\n').trim()
}

export function copyableTailoringText(result: Pick<TailoringResult, 'summary' | 'bullets' | 'cover_letter'>) {
  return [
    'PROFESSIONAL SUMMARY',
    result.summary.trim(),
    '',
    'TAILORED EXPERIENCE HIGHLIGHTS',
    ...result.bullets.map((bullet) => `• ${bullet.trim()}`),
    '',
    'COVER LETTER',
    result.cover_letter.trim(),
  ].join('\n').trim()
}
