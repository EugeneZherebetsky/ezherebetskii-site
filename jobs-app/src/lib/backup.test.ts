import { describe, expect, it } from 'vitest'
import { backupRows, parseBackup } from './backup'
import { makeCV, makeJob } from '../test/factories'

describe('parseBackup', () => {
  it('accepts a current backup', () => {
    expect(parseBackup(JSON.stringify({ opportunityDeskVersion: 1, jobs: [] }))).toEqual({ jobs: [], isLegacyBackup: false })
  })

  it('treats a file without a version as the older format', () => {
    expect(parseBackup(JSON.stringify({ jobs: [] })).isLegacyBackup).toBe(true)
  })

  it('rejects unrecognized files', () => {
    expect(() => parseBackup(JSON.stringify({ jobs: 'nope' }))).toThrow('not a recognized')
    expect(() => parseBackup(JSON.stringify({ opportunityDeskVersion: 2, jobs: [] }))).toThrow('not a recognized')
  })

  it('refuses an oversized backup', () => {
    const jobs = Array.from({ length: 1001 }, () => ({}))
    expect(() => parseBackup(JSON.stringify({ opportunityDeskVersion: 1, jobs }))).toThrow('too large')
  })
})

describe('backupRows', () => {
  it('converts older entries into current applications', () => {
    const backup = parseBackup(JSON.stringify({ jobs: [{ company: 'Acme', role: 'Engineer', status: 'phone screen', mode: 'on-site' }] }))
    const [row] = backupRows(backup, 'user-1', []) as Array<Record<string, unknown>>
    expect(row.user_id).toBe('user-1')
    expect(row.company).toBe('Acme')
    expect(row.status).toBe('phone_screen')
    expect(row.work_mode).toBe('onsite')
  })

  it('keeps ids from a current backup and drops links to missing CVs', () => {
    const job = makeJob({ id: 'job-9', cv_id: 'cv-gone' })
    const backup = parseBackup(JSON.stringify({ opportunityDeskVersion: 1, jobs: [job] }))
    const [row] = backupRows(backup, 'user-1', [makeCV({ id: 'cv-1' })]) as Array<Record<string, unknown>>
    expect(row.id).toBe('job-9')
    expect(row.cv_id).toBeNull()
  })

  it('rejects entries that are not applications', () => {
    const backup = parseBackup(JSON.stringify({ opportunityDeskVersion: 1, jobs: [{ id: 'x' }] }))
    expect(() => backupRows(backup, 'user-1', [])).toThrow('incomplete application')
  })
})
