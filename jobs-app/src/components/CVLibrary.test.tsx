import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CVLibrary } from './CVLibrary'
import { makeCV, makeCVBlock } from '../test/factories'

const noop = vi.fn()
const asyncNoop = vi.fn(async () => {})

function renderLibrary(overrides: Partial<Parameters<typeof CVLibrary>[0]> = {}) {
  const props = {
    cvs: [makeCV({ id: 'cv-1', name: 'General CV' }), makeCV({ id: 'cv-2', name: 'Data CV', tailored_company: 'Globex' })],
    blocks: [],
    busy: false,
    onAdd: noop,
    onEdit: noop,
    onDownload: asyncNoop,
    onDelete: asyncNoop,
    onBuild: noop,
    onAddBlock: noop,
    onEditBlock: noop,
    onDeleteBlock: asyncNoop,
    ...overrides,
  }
  render(<CVLibrary {...props} />)
  return props
}

describe('CVLibrary', () => {
  it('filters the library as the user searches', async () => {
    renderLibrary()
    expect(screen.getByRole('heading', { name: 'General CV' })).toBeDefined()
    await userEvent.type(screen.getByLabelText('Search CVs'), 'globex')
    expect(screen.queryByRole('heading', { name: 'General CV' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Data CV' })).toBeDefined()
  })

  it('invites the first CV block when none exist', () => {
    renderLibrary()
    expect(screen.getByText('0 CV blocks')).toBeDefined()
    expect(screen.getByText('Write each part once')).toBeDefined()
  })

  it('lists saved blocks instead of the invitation', () => {
    renderLibrary({ blocks: [makeCVBlock({ title: 'Led a migration' })] })
    expect(screen.getByText('1 CV blocks')).toBeDefined()
    expect(screen.getByText('Led a migration')).toBeDefined()
  })
})
