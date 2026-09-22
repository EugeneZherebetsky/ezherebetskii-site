import { supabase } from '../lib/supabase'
import type { Contact, ContactInteraction, ContactStage } from '../types'
import { saveVersioned, type SaveResult } from './versioned'

const TABLE = 'contacts'
const INTERACTIONS = 'contact_interactions'

type ContactRow = Omit<Contact, 'last_interaction_at'> & { contact_interactions?: Array<{ occurred_at: string }> }

/** Contacts with the date of their most recent logged interaction folded in. */
export async function listContacts() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, contact_interactions(occurred_at)')
    .order('updated_at', { ascending: false })
    .order('occurred_at', { referencedTable: INTERACTIONS, ascending: false })
    .limit(1, { referencedTable: INTERACTIONS })
  if (error) return { data: null, error }
  const contacts = ((data ?? []) as ContactRow[]).map(({ contact_interactions: latestInteraction, ...contact }) => ({
    ...contact,
    last_interaction_at: latestInteraction?.[0]?.occurred_at ?? null,
  }))
  return { data: contacts as Contact[], error: null }
}

export function saveContactRecord(editing: Contact | 'new', payload: object, userId: string): Promise<SaveResult<Contact>> {
  return saveVersioned<Contact>(TABLE, editing, payload, userId)
}

export function deleteContactRow(contact: Contact) {
  return supabase.from(TABLE).delete().eq('id', contact.id).eq('version', contact.version).select('id').maybeSingle()
}

export function updateContactStage(contact: Contact, stage: ContactStage) {
  return supabase.from(TABLE).update({ pipeline_stage: stage }).eq('id', contact.id).eq('version', contact.version).select('id').maybeSingle()
}

export function listInteractions(contactId: string) {
  return supabase.from(INTERACTIONS).select('*').eq('contact_id', contactId).order('occurred_at', { ascending: false })
}

export function insertInteraction(userId: string, payload: object) {
  return supabase.from(INTERACTIONS).insert({ ...payload, user_id: userId })
}

export function deleteInteractionRow(interaction: ContactInteraction) {
  return supabase.from(INTERACTIONS).delete().eq('id', interaction.id).eq('version', interaction.version).select('id').maybeSingle()
}
