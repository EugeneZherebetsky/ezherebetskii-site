import { supabase } from '../lib/supabase'
import type { CVBlock } from '../types'
import { saveVersioned, type SaveResult } from './versioned'

const TABLE = 'cv_blocks'

export function listCVBlocks() {
  return supabase.from(TABLE).select('*').order('block_type', { ascending: true }).order('sort_order', { ascending: true })
}

export function saveCVBlockRecord(editing: CVBlock | 'new', payload: object, userId: string): Promise<SaveResult<CVBlock>> {
  return saveVersioned<CVBlock>(TABLE, editing, payload, userId)
}

export function deleteCVBlockRow(block: CVBlock) {
  return supabase.from(TABLE).delete().eq('id', block.id).eq('version', block.version).select('id').maybeSingle()
}
