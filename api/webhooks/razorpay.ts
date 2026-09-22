import { errorMessage, isDuplicate } from '../_lib/errors'
import { razorpayEnv } from '../_lib/env'
import {
  headerValue,
  readRawBody,
  sendError,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/http'
import { ensureProfile } from '../_lib/profiles'
import { mapStatus, periodMonthFrom, toIso, verifyWebhookSignature } from '../_lib/razorpay'
import { supabaseAdmin } from '../_lib/supabaseAdmin'

/** Signature verification needs the untouched bytes, so do not parse the body. */
export const config = { api: { bodyParser: false } }

type RzpSubscription = {
  id: string
  status?: string
  plan_id?: string
  customer_id?: string | null
  current_start?: number | null
  current_end?: number | null
  notes?: Record<string, string> | null
}

type RzpPayment = {
  id: string
  amount?: number
  currency?: string
  status?: string
}

type RzpEvent = {
  event: string
  created_at?: number
  payload?: {
    subscription?: { entity?: RzpSubscription }
    payment?: { entity?: RzpPayment }
  }
}

/** Razorpay retries reuse the event id, so it doubles as an idempotency key. */
function eventKey(req: ApiRequest, event: RzpEvent, entityId: string): string {
  const header = headerValue(req, 'x-razorpay-event-id')
  if (header) return header
  return `${event.event}:${entityId}:${event.created_at ?? 0}`
}

/**
 * Keeps our subscription state in step with Razorpay.
 *
 * This is what makes the PRD's renewal requirement real. Razorpay holds the
 * mandate and charges each cycle itself; every one of those events lands here,
 * and the status and period are mirrored from the gateway rather than inferred.
 * It also records the charity contribution for each successful charge, because
 * that ledger must reflect money actually collected.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed')
  }

  const config = razorpayEnv()

  let event: RzpEvent

  try {
    const rawBody = await readRawBody(req)
    const signature = headerValue(req, 'x-razorpay-signature')

    if (!verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
      console.error('razorpay webhook: signature verification failed')
      return sendError(res, 400, 'Invalid Razorpay signature.')
    }

    event = JSON.parse(rawBody.toString('utf8')) as RzpEvent
  } catch (error) {
    console.error('razorpay webhook: could not read the request', error)
    return sendError(res, 400, 'Malformed Razorpay webhook payload.')
  }

  const subscription = event.payload?.subscription?.entity
  const payment = event.payload?.payment?.entity
  const entityId = subscription?.id ?? payment?.id ?? 'unknown'

  const admin = supabaseAdmin()
  const key = eventKey(req, event, entityId)

  // Idempotency: a primary-key conflict means this event was already applied.
  const { error: duplicateError } = await admin
    .from('webhook_events')
    .insert({ id: key, provider: 'razorpay', type: event.event })

  if (duplicateError) {
    if (duplicateError.code === '23505') {
      return sendJson(res, 200, { received: true, duplicate: true })
    }
    console.error('razorpay webhook: could not record event', duplicateError)
    return sendError(res, 500, 'Could not record the webhook event.')
  }

  try {
    if (!subscription) {
      // payment.failed carries no subscription entity; subscription.halted is the
      // authoritative signal for a failing mandate and arrives separately.
      console.warn(`razorpay webhook: ${event.event} carried no subscription entity`, {
        paymentId: payment?.id,
      })
      return sendJson(res, 200, { received: true, handled: false })
    }

    // Prefer the stored mapping; fall back to the notes attached at creation.
    const { data: existing } = await admin
      .from('subscriptions')
      .select('id, user_id')
      .eq('provider_subscription_id', subscription.id)
      .maybeSingle()

    const userId =
      (existing as { user_id: string } | null)?.user_id ?? subscription.notes?.user_id ?? null

    if (!userId) {
      // Retrying will not fix this, but silently dropping a paid subscription is
      // worse — fail loudly so it surfaces in Razorpay's webhook log.
      console.error(`razorpay webhook: cannot map subscription ${subscription.id} to a user`, {
        notes: subscription.notes,
      })
      return sendError(res, 500, 'Could not map the subscription to a user.')
    }

    // The subscription and ledger rows both reference profiles. A webhook can
    // arrive before the browser has ever loaded the app, so the row has to be
    // guaranteed here too.
    await ensureProfile(userId)

    const patch: Record<string, unknown> = {
      user_id: userId,
      provider: 'razorpay',
      provider_subscription_id: subscription.id,
      provider_customer_id: subscription.customer_id ?? null,
      status: mapStatus(subscription.status),
      current_period_start: toIso(subscription.current_start),
      current_period_end: toIso(subscription.current_end),
    }

    const plan = subscription.notes?.plan
    if (plan === 'monthly' || plan === 'yearly') {
      patch.plan = plan
    }

    // Trust the amount actually charged over anything recorded earlier.
    if (payment?.amount) {
      patch.amount_cents = payment.amount
    }

    await admin.from('subscriptions').upsert(patch, { onConflict: 'user_id' })

    // --------------------------------------------------- Contribution ledger
    // Only a successful charge funds the charity. Keyed on the payment id, whose
    // unique constraint is what makes a webhook retry safe.
    if (event.event === 'subscription.charged' && payment?.id) {
      const { data: subscriptionRow } = await admin
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      const { data: profile } = await admin
        .from('profiles')
        .select('charity_id, charity_percentage')
        .eq('id', userId)
        .maybeSingle()

      const percentage = Number(
        (profile as { charity_percentage?: number } | null)?.charity_percentage ?? 0,
      )

      const chargedAt = subscription.current_start
        ? new Date(subscription.current_start * 1000)
        : new Date()

      const { error: ledgerError } = await admin.from('charity_contributions').insert({
        user_id: userId,
        charity_id: (profile as { charity_id?: string } | null)?.charity_id ?? null,
        subscription_id: (subscriptionRow as { id: string } | null)?.id ?? null,
        amount_cents: Math.round(((payment.amount ?? 0) * percentage) / 100),
        period_month: periodMonthFrom(chargedAt),
        provider_payment_id: payment.id,
      })

      // 23505 means this payment is already recorded — a retry, not a failure.
      if (ledgerError && !isDuplicate(ledgerError)) throw ledgerError
    }
  } catch (error) {
    // Roll back the idempotency record so Razorpay's retry is processed rather
    // than silently skipped.
    await admin.from('webhook_events').delete().eq('id', key)
    console.error(`razorpay webhook: failed to process ${event.event}`, errorMessage(error))
    return sendError(res, 500, 'Could not process the webhook event.')
  }

  return sendJson(res, 200, { received: true })
}
