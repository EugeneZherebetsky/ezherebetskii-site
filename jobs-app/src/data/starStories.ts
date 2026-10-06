import { supabase } from '../lib/supabase'
import type { StarStory } from '../types'
import { saveVersioned, type SaveResult } from './versioned'

const TABLE = 'star_stories'

export function listStarStories() {
  return supabase.from(TABLE).select('*').order('updated_at', { ascending: false })
}

export function saveStarStoryRecord(editing: StarStory | 'new', payload: object, userId: string): Promise<SaveResult<StarStory>> {
  return saveVersioned<StarStory>(TABLE, editing, payload, userId)
}

export function deleteStarStoryRow(story: StarStory) {
  return supabase.from(TABLE).delete().eq('id', story.id).eq('version', story.version).select('id').maybeSingle()
}
