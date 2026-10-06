import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal stand-in for the query builder chain the data layer uses. */
const calls: Array<{ table: string; op: string; payload?: unknown }> = []
let insertResult: { data: unknown; error: unknown } = { data: { id: 'a', version: 1 }, error: null }
let updateResult: { data: unknown; error: unknown } = { data: { id: 'a', version: 2 }, error: null }
let versionResult: { data: unknown; error: unknown } = { data: { version: 7 }, error: null }

vi.mock('../lib/supabase', () => {
  const chain = (result: () => { data: unknown; error: unknown }) => {
    const builder: Record<string, unknown> = {}
    for (const method of ['eq', 'select']) builder[method] = () => builder
    builder.maybeSingle = async () => result()
    return builder
  }
  return {
    supabase: {
      from: (table: string) => ({
        insert: (payload: unknown) => { calls.push({ table, op: 'insert', payload }); return chain(() => insertResult) },
        update: (payload: unknown) => { calls.push({ table, op: 'update', payload }); return chain(() => updateResult) },
        select: () => { calls.push({ table, op: 'select' }); return chain(() => versionResult) },
        delete: () => { calls.push({ table, op: 'delete' }); return chain(() => updateResult) },
      }),
    },
  }
})

const { deleteVersioned, saveVersioned } = await import('./versioned')

const existing = { id: 'a', version: 3 }

beforeEach(() => {
  calls.length = 0
  insertResult = { data: { id: 'a', version: 1 }, error: null }
  updateResult = { data: { id: 'a', version: 4 }, error: null }
  versionResult = { data: { version: 7 }, error: null }
})

describe('saveVersioned', () => {
  it('inserts a new record with its owner', async () => {
    expect(await saveVersioned('jobs', 'new', { company: 'Acme' }, 'user-1')).toEqual({ kind: 'saved' })
    expect(calls[0]).toEqual({ table: 'jobs', op: 'insert', payload: { company: 'Acme', user_id: 'user-1' } })
  })

  it('reports a saved update', async () => {
    expect(await saveVersioned('jobs', existing, { company: 'Acme' }, 'user-1')).toEqual({ kind: 'saved' })
  })

  it('returns a refreshed baseline when another device changed the record', async () => {
    updateResult = { data: null, error: null }
    expect(await saveVersioned('jobs', existing, {}, 'user-1')).toEqual({ kind: 'conflict', record: { id: 'a', version: 7 } })
  })

  it('reports a record deleted elsewhere', async () => {
    updateResult = { data: null, error: null }
    versionResult = { data: null, error: null }
    expect(await saveVersioned('jobs', existing, {}, 'user-1')).toEqual({ kind: 'deleted' })
  })

  it('passes the write error through', async () => {
    updateResult = { data: null, error: { message: 'permission denied' } }
    expect(await saveVersioned('jobs', existing, {}, 'user-1')).toEqual({ kind: 'error', message: 'permission denied' })
  })
})

describe('deleteVersioned', () => {
  it('confirms a delete that matched the version', async () => {
    expect(await deleteVersioned('jobs', existing)).toEqual({ kind: 'deleted' })
  })

  it('reports a delete that matched nothing as a conflict', async () => {
    updateResult = { data: null, error: null }
    expect(await deleteVersioned('jobs', existing)).toEqual({ kind: 'conflict' })
  })
})
