import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { JOB_SEARCH_SOURCE_LABELS, JOB_SEARCH_SOURCES, searchLiveJobs, type JobSearchResult, type JobSearchSource } from '../lib/jobSearch'
import type { Job } from '../types'

type JobSearchProps = {
  jobs: Job[]
  busy: boolean
  onSave: (result: JobSearchResult) => Promise<void>
}

function publishedLabel(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function JobSearch({ jobs, busy, onSave }: JobSearchProps) {
  const [query, setQuery] = useState('IT infrastructure')
  const [location, setLocation] = useState('')
  const [source, setSource] = useState<JobSearchSource>('remotive')
  const [results, setResults] = useState<JobSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  const savedKeys = useMemo(() => new Set(jobs.flatMap((job) => {
    const keys: string[] = []
    if (job.source && job.external_job_id) keys.push(`${job.source.toLowerCase()}:${job.external_job_id}`)
    if (job.job_url) keys.push(`url:${job.job_url}`)
    return keys
  })), [jobs])

  function isSaved(result: JobSearchResult) {
    return savedKeys.has(`${result.sourceLabel.toLowerCase()}:${result.externalId}`) || savedKeys.has(`url:${result.url}`)
  }

  function changeSource(nextSource: JobSearchSource) {
    request.current?.abort()
    setSource(nextSource)
    setResults([])
    setHasSearched(false)
    setError('')
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault()
    const cleanQuery = query.trim()
    if (cleanQuery.length < 2) {
      setError('Enter at least two letters or numbers to search.')
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setSearching(true)
    setError('')
    setHasSearched(true)
    try {
      setResults(await searchLiveJobs(source, cleanQuery, location.trim(), controller.signal))
    }
    catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === 'AbortError') return
      setResults([])
      setError(searchError instanceof Error ? searchError.message : 'Live search is unavailable. Please try again later.')
    }
    finally {
      if (request.current === controller) {
        request.current = null
        setSearching(false)
      }
    }
  }

  return (
    <section className="job-search-view">
      <section className="workspace-card job-search-panel">
        <div>
          <p className="eyebrow">Live vacancies</p>
          <h2>Search public job feeds</h2>
          <p>Find a role, open the original listing, or save it as a synchronized opportunity.</p>
        </div>
        <form className="job-search-form" onSubmit={(event) => void runSearch(event)}>
          <label>Keywords<input disabled={searching} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Infrastructure manager" /></label>
          <label>Location<input disabled={searching} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional country or city" /></label>
          <label>Source<select disabled={searching} value={source} onChange={(event) => changeSource(event.target.value as JobSearchSource)}>{JOB_SEARCH_SOURCES.map((item) => <option key={item} value={item}>{JOB_SEARCH_SOURCE_LABELS[item]}</option>)}</select></label>
          <button className="button primary" disabled={searching} type="submit">{searching ? 'Searching…' : 'Search jobs'}</button>
        </form>
        <small>{source === 'remotive' ? 'Remotive provides remote roles and requires every result to link back to its original listing.' : 'Arbeitnow provides current European roles from employer job systems.'}</small>
      </section>

      <div className="search-feedback" aria-live="polite">
        {error && <div className="error-banner">{error}</div>}
        {!error && hasSearched && !searching && <span>{results.length ? `${results.length} matching vacancies` : 'No matches found. Try broader keywords or remove the location.'}</span>}
      </div>

      {results.length > 0 && <section className="job-result-grid" aria-label="Live job search results">
        {results.map((result) => {
          const saved = isSaved(result)
          const date = publishedLabel(result.publishedAt)
          return (
            <article className="job-result-card" key={result.key}>
              <div className="job-result-source"><span>{result.sourceLabel}</span>{date && <time dateTime={result.publishedAt}>{date}</time>}</div>
              <div><h3>{result.title}</h3><strong>{result.company}</strong><p>{result.location}{result.salary ? ` · ${result.salary}` : ''}</p></div>
              {result.tags.length > 0 && <div className="job-result-tags">{result.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
              <p className="job-result-description">{result.description || 'Open the original listing to read the full job description.'}</p>
              <div className="job-result-actions">
                <a className="button secondary" href={result.url} target="_blank" rel="noreferrer">View on {result.sourceLabel}</a>
                <button className={saved ? 'button secondary' : 'button primary'} disabled={busy || saved} onClick={() => void onSave(result)}>{saved ? 'Saved to tracker' : 'Save to tracker'}</button>
              </div>
            </article>
          )
        })}
      </section>}
    </section>
  )
}
