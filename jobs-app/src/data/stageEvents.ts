import { supabase } from '../lib/supabase'
import type { JobStageEvent } from '../types'

const PAGE_SIZE = 1000

// The API caps every request at its configured max_rows (1000), so stage
// history must be paged; a single capped ascending query would permanently
// hide the newest events once an account exceeds the cap.
export async function listAllStageEvents(): Promise<{ data: JobStageEvent[] | null; error: { message: string } | null }> {
  const events: JobStageEvent[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('job_stage_events')
      .select('*')
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    const page = (data ?? []) as JobStageEvent[]
    events.push(...page)
    if (page.length < PAGE_SIZE) return { data: events, error: null }
  }
}
