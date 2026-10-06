import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApplicationsView } from './Applications'
import { makeCV, makeJob } from '../test/factories'

function renderView(overrides: Partial<Parameters<typeof ApplicationsView>[0]> = {}) {
  const props = {
    jobs: [makeJob({ role_title: 'Platform Engineer', company: 'Acme' })],
    cvs: [],
    sends: [],
    total: 1,
    search: '',
    filter: 'all' as const,
    busy: false,
    onSearch: vi.fn(),
    onFilter: vi.fn(),
    onEdit: vi.fn(),
    onTailor: vi.fn(),
    onDelete: vi.fn(async () => {}),
    onDownloadCV: vi.fn(async () => {}),
    ...overrides,
  }
  render(<ApplicationsView {...props} />)
  return props
}

describe('ApplicationsView', () => {
  it('lists applications with their totals', () => {
    renderView()
    expect(screen.getByText('1 applications')).toBeDefined()
    expect(screen.getByText('Platform Engineer')).toBeDefined()
  })

  it('reports typing in the search box', async () => {
    const props = renderView()
    await userEvent.type(screen.getByLabelText('Search applications'), 'a')
    expect(props.onSearch).toHaveBeenCalledWith('a')
  })

  it('explains an empty result differently from an empty pipeline', () => {
    renderView({ jobs: [], total: 0 })
    expect(screen.getByText('Your pipeline is ready')).toBeDefined()
  })

  it('offers the linked CV download only when a file is stored', () => {
    renderView({
      cvs: [makeCV({ id: 'cv-1', storage_path: 'user/cv.pdf' })],
      jobs: [makeJob({ cv_id: 'cv-1' })],
    })
    expect(screen.getByRole('button', { name: 'Download' })).toBeDefined()
  })

  it('asks to edit, tailor and delete the chosen application', async () => {
    const props = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tailor CV' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(props.onEdit).toHaveBeenCalledOnce()
    expect(props.onTailor).toHaveBeenCalledOnce()
    expect(props.onDelete).toHaveBeenCalledOnce()
  })
})
