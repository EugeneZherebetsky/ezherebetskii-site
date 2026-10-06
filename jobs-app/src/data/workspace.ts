import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { listApplicationSends } from './applicationSends'
import { listContacts } from './contacts'
import { listCVBlocks } from './cvBlocks'
import { listCVs } from './cvs'
import { listInterviewPreps } from './interviewPreps'
import { listJobs } from './jobs'
import { listOutreachEmails } from './outreachEmails'
import { readSettings } from './settings'
import { listAllStageEvents } from './stageEvents'
import { listStarStories } from './starStories'

/** One round trip for everything the workspace shows. */
export async function fetchWorkspace(userId: string) {
  const [jobs, cvs, settings, sends, contacts, stories, preps, stageEvents, blocks, outreach] = await Promise.all([
    listJobs(),
    listCVs(),
    readSettings(userId),
    listApplicationSends(),
    listContacts(),
    listStarStories(),
    listInterviewPreps(),
    listAllStageEvents(),
    listCVBlocks(),
    listOutreachEmails(),
  ])
  return { jobs, cvs, settings, sends, contacts, stories, preps, stageEvents, blocks, outreach }
}

type WorkspaceListeners = {
  /** Any synchronized record changed. */
  onChange: () => void
  /** A contact interaction changed, so open contact history must reload too. */
  onNetworkingChange: () => void
}

/** Tables whose inserts and updates only need the workspace reloaded. */
const WATCHED_TABLES = [
  'jobs',
  'cvs',
  'user_settings',
  'application_sends',
  'contacts',
  'star_stories',
  'interview_preps',
  'job_stage_events',
  'cv_blocks',
  'outreach_emails',
]

/** Subscribes to this user's private synchronization channel. */
export async function subscribeToWorkspace(session: Session, listeners: WorkspaceListeners): Promise<RealtimeChannel> {
  await supabase.realtime.setAuth(session.access_token)
  const filter = `user_id=eq.${session.user.id}`
  let channel = supabase.channel(`opportunity-desk:${session.user.id}`, { config: { private: true } })

  for (const table of WATCHED_TABLES) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, listeners.onChange)
  }
  channel = channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_interactions', filter }, listeners.onNetworkingChange)
    .on('broadcast', { event: 'cv_deleted' }, listeners.onChange)
    .on('broadcast', { event: 'record_deleted' }, listeners.onNetworkingChange)

  return channel.subscribe()
}

export function unsubscribeFromWorkspace(channel: RealtimeChannel) {
  return supabase.removeChannel(channel)
}

export function signOutWorkspace() {
  return supabase.auth.signOut()
}
