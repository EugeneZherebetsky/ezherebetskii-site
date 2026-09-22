import type { ChangeEvent } from 'react'
import type { Job } from '../types'

type BackupViewProps = {
  jobs: Job[]
  busy: boolean
  onJson: () => void
  onCsv: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
}

export function BackupView({ jobs, busy, onJson, onCsv, onImport }: BackupViewProps) {
  return <div className="settings-grid"><section className="workspace-card panel"><p className="eyebrow">Portable application copy</p><h2>Export applications</h2><p>Download application records as a restorable JSON file or a CSV spreadsheet. CV files remain protected in the separate private library. Contacts and interview preparation are not yet part of this backup.</p><div className="button-row"><button className="button primary" onClick={onJson}>Download JSON backup</button><button className="button secondary" onClick={onCsv}>Download CSV</button></div></section><section className="workspace-card panel"><p className="eyebrow">Restore applications</p><h2>Import a backup</h2><p>Import a JSON file created by this version of Opportunity Desk. Matching application IDs are updated; new ones are added.</p><label className={busy ? 'button secondary file-button disabled' : 'button secondary file-button'}>{busy ? 'Importing…' : 'Choose JSON backup'}<input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => void onImport(event)} /></label><small>{jobs.length} applications are currently synchronized.</small></section></div>
}
