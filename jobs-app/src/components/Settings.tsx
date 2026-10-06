import { useEffect, useState } from 'react'
import { viewTitle } from '../lib/navigation'
import { APP_VIEWS, type DefaultView, type SettingsDraft, type UserSettings } from '../types'

type SettingsViewProps = {
  settings: UserSettings
  busy: boolean
  googleConnected: boolean
  onSave: (draft: SettingsDraft) => Promise<void>
  onConnectGoogle: (clientId: string) => Promise<void>
  onEnableNotifications: () => Promise<void>
}

function settingsDraft(value: UserSettings): SettingsDraft {
  return {
    default_view: value.default_view,
    reminders_enabled: value.reminders_enabled,
    reminder_lead_hours: value.reminder_lead_hours,
    timezone: value.timezone,
    google_client_id: value.google_client_id ?? '',
    email_reminders_enabled: value.email_reminders_enabled,
    email_reminder_hour: value.email_reminder_hour,
  }
}

export function SettingsView({ settings, busy, googleConnected, onSave, onConnectGoogle, onEnableNotifications }: SettingsViewProps) {
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsDraft(settings))
  useEffect(() => setDraft(settingsDraft(settings)), [settings])
  return (
    <section className="workspace-card settings-form">
      <div><p className="eyebrow">Synchronized preferences</p><h2>Workspace settings</h2><p>These preferences follow your account to every device. Browser notification permission and short-lived Google access are still approved separately in each browser.</p></div>
      <label>Start page<select value={draft.default_view} onChange={(event) => setDraft({ ...draft, default_view: event.target.value as DefaultView })}>{APP_VIEWS.filter((candidate): candidate is DefaultView => ['dashboard', 'board', 'applications', 'reminders', 'cvs'].includes(candidate)).map((candidate) => <option value={candidate} key={candidate}>{viewTitle(candidate)}</option>)}</select></label>
      <label>Timezone<input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></label>
      <label>Reminder lead time<select value={draft.reminder_lead_hours} onChange={(event) => setDraft({ ...draft, reminder_lead_hours: Number(event.target.value) })}><option value={0}>At the due time</option><option value={1}>1 hour before</option><option value={6}>6 hours before</option><option value={24}>1 day before</option><option value={72}>3 days before</option><option value={168}>1 week before</option></select></label>
      <label className="check-label"><input type="checkbox" checked={draft.reminders_enabled} onChange={(event) => setDraft({ ...draft, reminders_enabled: event.target.checked })} />Show reminders while Opportunity Desk is open</label>
      <div className="settings-divider"><p className="eyebrow">Email reminders</p><h3>{draft.email_reminders_enabled ? 'One daily digest of due follow-ups' : 'Off — reminders only appear in the browser'}</h3><p>A server function checks hourly and sends at most one email per day, in your timezone, listing application and networking follow-ups that are newly due. Nothing is sent while there is nothing due.</p></div>
      <label className="check-label"><input type="checkbox" checked={draft.email_reminders_enabled} onChange={(event) => setDraft({ ...draft, email_reminders_enabled: event.target.checked })} />Email me due follow-ups at my account address</label>
      <label>Delivery hour<select value={draft.email_reminder_hour} onChange={(event) => setDraft({ ...draft, email_reminder_hour: Number(event.target.value) })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select><small>Local to the timezone above. Delivery also requires the server email secrets described in the developer notes.</small></label>
      <div className="settings-divider"><p className="eyebrow">Google Calendar and Gmail</p><h3>{googleConnected ? 'Connected for this session' : 'Connection ready when you are'}</h3><p>The OAuth client ID is public and synchronizes with your account. Google access tokens are short-lived and stay only in this browser's memory.</p></div>
      <label>Google OAuth client ID<input value={draft.google_client_id} onChange={(event) => setDraft({ ...draft, google_client_id: event.target.value })} placeholder="123456789-example.apps.googleusercontent.com" /><small>Enable the Google Calendar API and Gmail API, then use a Web application client whose authorized JavaScript origin includes this site.</small></label>
      <details className="setup-guide"><summary>Google Cloud setup</summary><ol><li>Create or open a project in <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a>.</li><li>Enable Google Calendar API and Gmail API.</li><li>Configure the OAuth consent screen and add your Google address as a test user if the app is in testing.</li><li>Create a Web application OAuth client and add <code>{window.location.origin}</code> as an authorized JavaScript origin.</li><li>Paste the client ID above, save settings, and connect Google.</li></ol></details>
      <div className="button-row"><button className="button primary" disabled={busy} onClick={() => void onSave(draft)}>{busy ? 'Saving…' : 'Save settings'}</button><button className="button secondary" disabled={busy || !draft.google_client_id.trim()} onClick={() => void onConnectGoogle(draft.google_client_id)}>{googleConnected ? 'Reconnect Google' : 'Connect Google'}</button><button className="button secondary" onClick={() => void onEnableNotifications()}>Allow browser notifications</button></div>
    </section>
  )
}
