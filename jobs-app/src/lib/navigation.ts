import type { AppView } from '../types'

export const NAV_ITEMS: Array<{ view: AppView; label: string; symbol: string }> = [
  { view: 'dashboard', label: 'Dashboard', symbol: '◫' },
  { view: 'board', label: 'Board', symbol: '▦' },
  { view: 'applications', label: 'Applications', symbol: '≡' },
  { view: 'reminders', label: 'Reminders', symbol: '◷' },
  { view: 'contacts', label: 'Network', symbol: '◎' },
  { view: 'outreach', label: 'Outreach', symbol: '✉' },
  { view: 'interviews', label: 'Interviews', symbol: '✦' },
  { view: 'analytics', label: 'Analytics', symbol: '◔' },
  { view: 'cvs', label: 'CV library', symbol: '▤' },
  { view: 'search', label: 'Find jobs', symbol: '⌕' },
  { view: 'backup', label: 'Backup', symbol: '⇅' },
  { view: 'settings', label: 'Settings', symbol: '⚙' },
]

export function viewTitle(view: AppView) {
  return NAV_ITEMS.find((item) => item.view === view)?.label ?? 'Opportunity Desk'
}
