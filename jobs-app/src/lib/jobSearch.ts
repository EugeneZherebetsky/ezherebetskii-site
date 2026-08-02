export const JOB_SEARCH_SOURCES = ['remotive', 'arbeitnow'] as const

export type JobSearchSource = (typeof JOB_SEARCH_SOURCES)[number]

export const JOB_SEARCH_SOURCE_LABELS: Record<JobSearchSource, string> = {
  remotive: 'Remotive',
  arbeitnow: 'Arbeitnow',
}

export type JobSearchResult = {
  key: string
  source: JobSearchSource
  sourceLabel: string
  externalId: string
  title: string
  company: string
  location: string
  description: string
  url: string
  salary: string
  publishedAt: string
  remote: boolean
  tags: string[]
}

type UnknownRecord = Record<string, unknown>
const SEARCH_CACHE_MS = 10 * 60 * 1000
const SEARCH_RESULT_LIMIT = 40
const ARBEITNOW_API_URL = new URL('https://www.arbeitnow.com/api/job-board-api')
const searchCache = new Map<string, { expiresAt: number; results: JobSearchResult[] }>()

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? value as UnknownRecord : null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function stripHtml(value: unknown) {
  const html = text(value)
  if (!html) return ''
  const document = new DOMParser().parseFromString(html, 'text/html')
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : []
}

function publicationDate(value: unknown) {
  const rawValue = typeof value === 'number' && Number.isFinite(value) ? value : text(value)
  if (rawValue === '') return ''
  const date = typeof rawValue === 'number' || /^\d+$/.test(rawValue)
    ? new Date(Number(rawValue) * 1000)
    : new Date(rawValue)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function matchesTerms(value: string, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const searchable = value.toLowerCase()
  return terms.every((term) => searchable.includes(term))
}

function matchesLocation(available: string, requested: string) {
  if (!requested) return true
  const location = available.toLowerCase()
  const query = requested.toLowerCase()
  return location.includes(query) || /\b(worldwide|anywhere|global)\b/.test(location)
}

async function fetchJson(url: URL, signal?: AbortSignal) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`The provider returned HTTP ${response.status}. Please try again later.`)
  try {
    return await response.json() as unknown
  }
  catch {
    throw new Error('The provider returned an unreadable response. Please try again later.')
  }
}

function remotiveResult(value: unknown): JobSearchResult | null {
  const job = record(value)
  if (!job) return null
  const externalId = String(job.id ?? '').trim()
  const title = text(job.title)
  const company = text(job.company_name)
  const url = text(job.url)
  if (!externalId || !title || !company || !url) return null
  const category = text(job.category)
  const jobType = text(job.job_type).replaceAll('_', ' ')
  return {
    key: `remotive:${externalId}`,
    source: 'remotive',
    sourceLabel: JOB_SEARCH_SOURCE_LABELS.remotive,
    externalId,
    title,
    company,
    location: text(job.candidate_required_location) || 'Remote',
    description: stripHtml(job.description),
    url,
    salary: text(job.salary),
    publishedAt: text(job.publication_date),
    remote: true,
    tags: [category, jobType].filter(Boolean),
  }
}

function arbeitnowResult(value: unknown): JobSearchResult | null {
  const job = record(value)
  if (!job) return null
  const externalId = text(job.slug)
  const title = text(job.title)
  const company = text(job.company_name)
  const url = text(job.url)
  if (!externalId || !title || !company || !url) return null
  const tags = [...stringList(job.tags), ...stringList(job.job_types)]
  return {
    key: `arbeitnow:${externalId}`,
    source: 'arbeitnow',
    sourceLabel: JOB_SEARCH_SOURCE_LABELS.arbeitnow,
    externalId,
    title,
    company,
    location: text(job.location) || (job.remote === true ? 'Remote' : 'Location not specified'),
    description: stripHtml(job.description),
    url,
    salary: '',
    publishedAt: publicationDate(job.created_at),
    remote: job.remote === true,
    tags: [...new Set(tags)].slice(0, 5),
  }
}

async function searchRemotive(query: string, location: string, signal?: AbortSignal) {
  const url = new URL('https://remotive.com/api/remote-jobs')
  url.searchParams.set('search', query)
  url.searchParams.set('limit', '40')
  const payload = record(await fetchJson(url, signal))
  const jobs = payload && Array.isArray(payload.jobs) ? payload.jobs : []
  return jobs
    .map(remotiveResult)
    .filter((job): job is JobSearchResult => Boolean(job))
    .filter((job) => matchesLocation(job.location, location))
}

async function searchArbeitnow(query: string, location: string, signal?: AbortSignal) {
  const results: JobSearchResult[] = []
  const resultKeys = new Set<string>()
  const visitedPages = new Set<string>()
  let pageUrl: URL | null = new URL(ARBEITNOW_API_URL)

  while (pageUrl && results.length < SEARCH_RESULT_LIMIT) {
    if (visitedPages.has(pageUrl.href)) throw new Error('Arbeitnow returned a pagination loop. Please try again later.')
    visitedPages.add(pageUrl.href)

    const payload = record(await fetchJson(pageUrl, signal))
    const jobs = payload && Array.isArray(payload.data) ? payload.data : []
    for (const value of jobs) {
      const job = arbeitnowResult(value)
      if (!job || resultKeys.has(job.key)) continue
      if (!matchesTerms([job.title, job.company, job.description, ...job.tags].join(' '), query) || !matchesLocation(job.location, location)) continue
      resultKeys.add(job.key)
      results.push(job)
      if (results.length === SEARCH_RESULT_LIMIT) break
    }

    const links = payload ? record(payload.links) : null
    const nextLink = links ? text(links.next) : ''
    if (!nextLink || results.length === SEARCH_RESULT_LIMIT) {
      pageUrl = null
      continue
    }

    const nextUrl = new URL(nextLink, pageUrl)
    if (nextUrl.origin !== ARBEITNOW_API_URL.origin || nextUrl.pathname !== ARBEITNOW_API_URL.pathname) {
      throw new Error('Arbeitnow returned an unexpected pagination link. Please try again later.')
    }
    pageUrl = nextUrl
  }

  return results
}

export async function searchLiveJobs(source: JobSearchSource, query: string, location: string, signal?: AbortSignal) {
  const cacheKey = `${source}:${query.trim().toLowerCase()}:${location.trim().toLowerCase()}`
  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.results
  if (cached) searchCache.delete(cacheKey)
  const results = source === 'remotive'
    ? await searchRemotive(query, location, signal)
    : await searchArbeitnow(query, location, signal)
  searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_MS, results })
  return results
}
