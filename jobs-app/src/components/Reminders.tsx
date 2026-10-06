import { formatDateTime, relativeDueLabel } from '../lib/opportunities'
import type { Contact, Job, OutreachEmail } from '../types'

type RemindersViewProps = {
  jobs: Job[]
  contacts: Contact[]
  outreach: OutreachEmail[]
  onEdit: (job: Job) => void
  onEditContact: (contact: Contact) => void
  onOpenOutreach: (email: OutreachEmail) => void
  onEnable: () => Promise<void>
}

export function RemindersView({ jobs, contacts, outreach, onEdit, onEditContact, onOpenOutreach, onEnable }: RemindersViewProps) {
  return (
    <>
      <section className="workspace-card"><div className="workspace-head"><div><p className="eyebrow">Follow-up queue</p><h2>{jobs.length} scheduled actions</h2></div><button className="button secondary" onClick={() => void onEnable()}>Enable browser alerts</button></div>{jobs.length === 0 ? <div className="empty-state"><strong>Nothing is due</strong><span>Add a next action and date to an application to see it here.</span></div> : <div className="reminder-list">{jobs.map((job) => <button key={job.id} onClick={() => onEdit(job)}><time dateTime={job.next_action_at!}>{formatDateTime(job.next_action_at!)}</time><span><strong>{job.next_action || 'Follow up'}</strong><small>{job.role_title} at {job.company}</small></span><em className={new Date(job.next_action_at!).getTime() < Date.now() ? 'overdue' : ''}>{relativeDueLabel(job.next_action_at!)}</em></button>)}</div>}</section>
      {contacts.length > 0 && <section className="workspace-card"><div className="workspace-head"><div><p className="eyebrow">Networking</p><h2>{contacts.length} networking follow-ups</h2></div></div><div className="reminder-list">{contacts.map((contact) => <button key={contact.id} onClick={() => onEditContact(contact)}><time dateTime={contact.next_action_at!}>{formatDateTime(contact.next_action_at!)}</time><span><strong>{contact.next_action || 'Follow up'}</strong><small>{contact.name}{contact.company ? ` · ${contact.company}` : ''}</small></span><em className={new Date(contact.next_action_at!).getTime() < Date.now() ? 'overdue' : ''}>{relativeDueLabel(contact.next_action_at!)}</em></button>)}</div></section>}
      {outreach.length > 0 && <section className="workspace-card"><div className="workspace-head"><div><p className="eyebrow">Speculative outreach</p><h2>{outreach.length} unanswered message{outreach.length === 1 ? '' : 's'}</h2></div></div><div className="reminder-list">{outreach.map((email) => <button key={email.id} onClick={() => onOpenOutreach(email)}><time dateTime={email.follow_up_at!}>{formatDateTime(email.follow_up_at!)}</time><span><strong>Follow up on “{email.subject}”</strong><small>{email.company}{email.recipient_name ? ` · ${email.recipient_name}` : ''}</small></span><em className={new Date(email.follow_up_at!).getTime() < Date.now() ? 'overdue' : ''}>{relativeDueLabel(email.follow_up_at!)}</em></button>)}</div></section>}
    </>
  )
}
