// Scheduled reminder digests. Invoked hourly by pg_cron with a shared secret;
// never called from the browser. For every user who opted in, it emails one
// digest of newly due application and networking follow-ups through Resend.
// Duplicate protection lives in reminder_deliveries: one row per
// (user, item, next_action_at) is written only after a successful send.

import { createClient } from 'npm:@supabase/supabase-js@2.111.0'

const ACTIVE_JOB_STATUSES = ['saved', 'applied', 'phone_screen', 'interviewing', 'assessment', 'final_round', 'offer', 'on_hold']
const OVERDUE_WINDOW_MS = 7 * 86_400_000
const MAX_ITEMS_PER_EMAIL = 30

type ReminderSettings = {
  user_id: string
  timezone: string
  reminder_lead_hours: number
  email_reminder_hour: number
}

type DueItem = {
  item_type: 'job' | 'contact'
  item_id: string
  next_action_at: string
  title: string
  subtitle: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function localHour(timezone: string, at: Date): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', hour: 'numeric', hourCycle: 'h23' }).format(at)
    const hour = Number.parseInt(formatted, 10)
    return Number.isFinite(hour) ? hour : at.getUTCHours()
  }
  catch {
    return at.getUTCHours()
  }
}

function dueLabel(nextActionAt: string, now: Date) {
  const difference = new Date(nextActionAt).getTime() - now.getTime()
  const hours = Math.round(Math.abs(difference) / 3_600_000)
  if (difference < 0) return hours < 1 ? 'due now' : `${hours}h overdue`
  if (hours < 1) return 'due within an hour'
  if (hours < 48) return `due in ${hours}h`
  return `due in ${Math.round(hours / 24)} days`
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function digestEmail(items: DueItem[], now: Date) {
  const lines = items.map((item) => `• ${item.title} — ${item.subtitle} (${dueLabel(item.next_action_at, now)})`)
  const text = [
    'These follow-ups are due in Opportunity Desk:',
    '',
    ...lines,
    '',
    'Open https://jobs.ezherebetskii.com to act on them.',
    'You receive this daily digest because email reminders are enabled in your Opportunity Desk settings. Disable them there at any time.',
  ].join('\n')
  const html = [
    '<p>These follow-ups are due in <strong>Opportunity Desk</strong>:</p>',
    '<ul>',
    ...items.map((item) => `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.subtitle)} <em>(${dueLabel(item.next_action_at, now)})</em></li>`),
    '</ul>',
    '<p><a href="https://jobs.ezherebetskii.com">Open Opportunity Desk</a> to act on them.</p>',
    '<p style="color:#667085;font-size:12px">You receive this daily digest because email reminders are enabled in your Opportunity Desk settings. Disable them there at any time.</p>',
  ].join('')
  return { text, html }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const cronSecret = Deno.env.get('REMINDER_CRON_SECRET') ?? ''
  if (!cronSecret) return json({ error: 'REMINDER_CRON_SECRET is not configured.' }, 503)
  if (req.headers.get('x-reminder-secret') !== cronSecret) return json({ error: 'Unauthorized.' }, 401)

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (!resendKey) return json({ error: 'RESEND_API_KEY is not configured.' }, 503)
  const fromAddress = Deno.env.get('REMINDER_FROM_EMAIL') || 'Opportunity Desk <onboarding@resend.dev>'

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase server credentials are unavailable.' }, 503)
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const now = new Date()
  const overdueFloor = new Date(now.getTime() - OVERDUE_WINDOW_MS).toISOString()

  const { data: optedIn, error: settingsError } = await admin
    .from('user_settings')
    .select('user_id, timezone, reminder_lead_hours, email_reminder_hour')
    .eq('email_reminders_enabled', true)
  if (settingsError) return json({ error: settingsError.message }, 500)

  const summary: Array<Record<string, unknown>> = []

  for (const settings of (optedIn ?? []) as ReminderSettings[]) {
    const userId = settings.user_id
    if (localHour(settings.timezone, now) !== settings.email_reminder_hour) continue

    const leadHours = Math.min(Math.max(settings.reminder_lead_hours ?? 24, 0), 720)
    const horizon = new Date(now.getTime() + leadHours * 3_600_000).toISOString()

    const [jobsResult, contactsResult] = await Promise.all([
      admin
        .from('jobs')
        .select('id, role_title, company, next_action, next_action_at, status')
        .eq('user_id', userId)
        .in('status', ACTIVE_JOB_STATUSES)
        .not('next_action_at', 'is', null)
        .gte('next_action_at', overdueFloor)
        .lte('next_action_at', horizon),
      admin
        .from('contacts')
        .select('id, name, company, next_action, next_action_at, pipeline_stage')
        .eq('user_id', userId)
        .neq('pipeline_stage', 'closed')
        .not('next_action_at', 'is', null)
        .gte('next_action_at', overdueFloor)
        .lte('next_action_at', horizon),
    ])
    if (jobsResult.error || contactsResult.error) {
      summary.push({ user: userId, error: (jobsResult.error ?? contactsResult.error)?.message })
      continue
    }

    const candidates: DueItem[] = [
      ...(jobsResult.data ?? []).map((job) => ({
        item_type: 'job' as const,
        item_id: job.id as string,
        next_action_at: job.next_action_at as string,
        title: (job.next_action as string | null) || 'Application follow-up',
        subtitle: `${job.role_title} at ${job.company}`,
      })),
      ...(contactsResult.data ?? []).map((contact) => ({
        item_type: 'contact' as const,
        item_id: contact.id as string,
        next_action_at: contact.next_action_at as string,
        title: (contact.next_action as string | null) || 'Networking follow-up',
        subtitle: `${contact.name}${contact.company ? ` · ${contact.company}` : ''}`,
      })),
    ]
    if (!candidates.length) continue

    const { data: delivered, error: deliveredError } = await admin
      .from('reminder_deliveries')
      .select('item_type, item_id, next_action_at')
      .eq('user_id', userId)
      .in('item_id', candidates.map((item) => item.item_id))
    if (deliveredError) {
      summary.push({ user: userId, error: deliveredError.message })
      continue
    }
    const alreadySent = new Set((delivered ?? []).map((row) => `${row.item_type}:${row.item_id}:${new Date(row.next_action_at as string).getTime()}`))
    const dueItems = candidates
      .filter((item) => !alreadySent.has(`${item.item_type}:${item.item_id}:${new Date(item.next_action_at).getTime()}`))
      .sort((left, right) => new Date(left.next_action_at).getTime() - new Date(right.next_action_at).getTime())
      .slice(0, MAX_ITEMS_PER_EMAIL)
    if (!dueItems.length) continue

    const { data: userRecord, error: userError } = await admin.auth.admin.getUserById(userId)
    const recipient = userRecord?.user?.email
    if (userError || !recipient) {
      summary.push({ user: userId, error: userError?.message ?? 'No account email address.' })
      continue
    }

    const { text, html } = digestEmail(dueItems, now)
    const sendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipient],
        subject: `${dueItems.length} follow-up${dueItems.length === 1 ? '' : 's'} due — Opportunity Desk`,
        text,
        html,
      }),
    })
    if (!sendResponse.ok) {
      const detail = await sendResponse.text()
      summary.push({ user: userId, error: `Resend ${sendResponse.status}: ${detail.slice(0, 200)}` })
      continue
    }

    // Recorded only after the email is accepted, so a failed send is retried
    // on the next matching hour instead of being silently lost.
    const { error: recordError } = await admin
      .from('reminder_deliveries')
      .upsert(dueItems.map((item) => ({
        user_id: userId,
        item_type: item.item_type,
        item_id: item.item_id,
        next_action_at: item.next_action_at,
      })), { onConflict: 'user_id,item_type,item_id,next_action_at', ignoreDuplicates: true })
    summary.push({ user: userId, sent: dueItems.length, recordError: recordError?.message ?? null })
  }

  return json({ processed: summary.length, results: summary })
})
