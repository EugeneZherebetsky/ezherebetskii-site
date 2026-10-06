import { supabase } from '../lib/supabase'

/**
 * Shared helpers for the optimistic-locking pattern every synchronized table
 * uses: writes carry the version the user was looking at, and a write that
 * matches no row means the record changed or was removed on another device.
 */

export type VersionedRecord = { id: string; version: number }

export type SaveResult<T extends VersionedRecord> =
  | { kind: 'saved' }
  /** The record moved on; `record` carries the refreshed version baseline. */
  | { kind: 'conflict'; record: T }
  | { kind: 'deleted' }
  | { kind: 'error'; message: string }

export type DeleteResult =
  | { kind: 'deleted' }
  | { kind: 'conflict' }
  | { kind: 'error'; message: string }

export function versionedTable(table: string) {
  return {
    insert: (userId: string, payload: object, extra: object = {}) =>
      supabase.from(table).insert({ ...payload, ...extra, user_id: userId }).select('id, version').maybeSingle(),
    update: (id: string, version: number, payload: object) =>
      supabase.from(table).update(payload).eq('id', id).eq('version', version).select('id, version').maybeSingle(),
    readVersion: (id: string) => supabase.from(table).select('version').eq('id', id).maybeSingle(),
    remove: (id: string, version: number) =>
      supabase.from(table).delete().eq('id', id).eq('version', version).select('id').maybeSingle(),
  }
}

/** Inserts a new record, or updates an existing one at the version the user edited. */
export async function saveVersioned<T extends VersionedRecord>(
  table: string,
  editing: T | 'new',
  payload: object,
  userId: string,
  extraInsert: object = {},
): Promise<SaveResult<T>> {
  const rows = versionedTable(table)
  const result = editing === 'new'
    ? await rows.insert(userId, payload, extraInsert)
    : await rows.update(editing.id, editing.version, payload)

  if (result.error) return { kind: 'error', message: result.error.message }
  if (result.data || editing === 'new') return { kind: 'saved' }

  const { data: latest, error: latestError } = await rows.readVersion(editing.id)
  if (latestError) return { kind: 'error', message: latestError.message }
  if (!latest) return { kind: 'deleted' }
  return { kind: 'conflict', record: { ...editing, version: latest.version as number } }
}

/** Deletes a record at the version the user was looking at. */
export async function deleteVersioned(table: string, record: VersionedRecord): Promise<DeleteResult> {
  const { data, error } = await versionedTable(table).remove(record.id, record.version)
  if (error) return { kind: 'error', message: error.message }
  return data ? { kind: 'deleted' } : { kind: 'conflict' }
}
