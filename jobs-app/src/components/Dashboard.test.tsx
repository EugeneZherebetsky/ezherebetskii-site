import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardView } from './Dashboard'
import { makeJob } from '../test/factories'

const counts = { active: 3, interviews: 2, offers: 1, followUps: 4 }

describe('DashboardView', () => {
  it('shows the headline counts', () => {
    render(<DashboardView jobs={[]} counts={counts} reminders={[]} onEdit={() => {}} onViewAll={() => {}} />)
    expect(screen.getByText('Active pipeline').parentElement?.textContent).toBe('Active pipeline3')
    expect(screen.getByText('Offers').parentElement?.textContent).toBe('Offers1')
    expect(screen.getByText('No follow-ups are scheduled.')).toBeDefined()
    expect(screen.getByText('Add an application to see your pipeline.')).toBeDefined()
  })

  it('lists at most five next actions and opens the one clicked', async () => {
    const reminders = Array.from({ length: 6 }, (_, index) => makeJob({
      id: `job-${index}`,
      role_title: `Role ${index}`,
      next_action: `Follow up ${index}`,
      next_action_at: '2026-08-01T10:00:00.000Z',
    }))
    const onEdit = vi.fn()
    render(<DashboardView jobs={reminders} counts={counts} reminders={reminders} onEdit={onEdit} onViewAll={() => {}} />)

    expect(screen.queryByText('Follow up 5')).toBeNull()
    await userEvent.click(screen.getByText('Follow up 0'))
    expect(onEdit).toHaveBeenCalledWith(reminders[0])
  })

  it('links through to the full list', async () => {
    const onViewAll = vi.fn()
    render(<DashboardView jobs={[makeJob({})]} counts={counts} reminders={[]} onEdit={() => {}} onViewAll={onViewAll} />)
    await userEvent.click(screen.getByRole('button', { name: 'View all' }))
    expect(onViewAll).toHaveBeenCalledOnce()
  })
})
