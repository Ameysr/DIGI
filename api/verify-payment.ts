import Razorpay from 'razorpay'
import { getUserId } from './_lib/auth'
import { errorMessage, isDuplicate } from './_lib/errors'
import { razorpayEnv } from './_lib/env'
import { readJsonBody, sendError, sendJson, type ApiRequest, type ApiResponse } from './_lib/http'
import { PRICE_MONTHLY_PAISE, PRICE_YEARLY_PAISE } from './_lib/pricing'
import { ensureProfile } from './_lib/profiles'
import { periodMonthFrom, verifyPaymentSignature } from './_lib/razorpay'
import { supabaseAdmin } from './_lib/supabaseAdmin'

const PRICE_PAISE = {
  monthly: PRICE_MONTHLY_PAISE,
  yearly: PRICE_YEARLY_PAISE,
} as const

type PlanId = keyof typeof PRICE_PAISE

/** How long a single charge buys access for. */
const PERIOD_DAYS = {
  monthly: 30,
  yearly: 365,
} as const

type VerifyBody = {
  orderId?: string
  paymentId?: string
  signature?: string
}

/**
 * Completes a single-charge plan purchase.
 *
 * Used only in order mode — when this account cannot sell Razorpay subscriptions,
 * `api/billing.ts` falls back to one-off orders, and this is the half that
 * activates them. Subscriptions do NOT come through here: their webhook is
 * authoritative.
 *
 * This is the only path that grants access in order mode, so it trusts nothing
 * the browser sends beyond the three Razorpay identifiers. The plan, the amount
 * and the owning user are all read back from Razorpay, and the signature is what
 * proves the payment actually happened.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed')
  }

  try {
    const userId = await getUserId(req)
    if (!userId) {
      return sendError(res, 401, 'You must be signed in.')
    }

    const { orderId, paymentId, signature } = await readJsonBody<VerifyBody>(req)
    if (!orderId || !paymentId || !signature) {
      return sendError(res, 400, 'orderId, paymentId and signature are all required.')
    }

    const config = razorpayEnv()
    const admin = supabaseAdmin()

    // The subscription and ledger rows both reference profiles, so make sure one
    // exists before anything is written. Without this a missing profile becomes a
    // foreign-key violation *after* the customer has already been charged.
    await ensureProfile(userId)

    // 1. Signature first. Until this passes, nothing else matters — otherwise
    //    anyone could POST a made-up payment id and grant themselves access.
    const signatureValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
      secret: config.keySecret,
    })

    if (!signatureValid) {
      console.error('verify-payment: signature mismatch', { orderId, paymentId, userId })
      return sendError(res, 400, 'Invalid payment signature.')
    }

    const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret })

    // 2. Read the order back from Razorpay. The signature proves Razorpay issued
    //    this pair, but the plan and amount must come from the gateway.
    const order = (await razorpay.orders.fetch(orderId)) as {
      id: string
      amount: number
      notes?: Record<string, string> | null
    }

    const payment = (await razorpay.payments.fetch(paymentId)) as {
      id: string
      order_id?: string | null
      amount?: number
      status?: string
    }

    if (payment.order_id !== orderId) {
      console.error('verify-payment: payment does not belong to the order', { orderId, paymentId })
      return sendError(res, 400, 'That payment does not belong to this order.')
    }
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return sendError(res, 402, `That payment has not completed (status: ${payment.status}).`)
    }
    if (order.notes?.purpose !== 'subscription') {
      return sendError(res, 400, 'That order is not a plan purchase.')
    }
    if (order.notes?.user_id !== userId) {
      console.error('verify-payment: order belongs to another user', { orderId, userId })
      return sendError(res, 403, 'That order does not belong to your account.')
    }

    const plan = order.notes?.plan
    if (plan !== 'monthly' && plan !== 'yearly') {
      return sendError(res, 400, 'The order is missing a plan.')
    }

    // 3. The amount must match our price for that plan, so a tampered order
    //    cannot buy a year of access for the monthly price.
    const expected = PRICE_PAISE[plan as PlanId]
    if (order.amount !== expected) {
      console.error('verify-payment: amount does not match the plan price', {
        orderAmount: order.amount,
        expected,
        plan,
      })
      return sendError(res, 400, 'The order amount does not match the plan price.')
    }

    // 4. Idempotency. The ledger is unique on the payment id, so an existing row
    //    means this payment has already been applied and must not extend the
    //    period a second time.
    const { data: priorContribution } = await admin
      .from('charity_contributions')
      .select('id')
      .eq('provider_payment_id', paymentId)
      .maybeSingle()

    if (priorContribution) {
      return sendJson(res, 200, { activated: true, alreadyVerified: true, plan })
    }

    // 5. Paying while still inside a paid period extends it from its end rather
    //    than throwing the remaining days away.
    const { data: existing } = await admin
      .from('subscriptions')
      .select('id, current_period_end')
      .eq('user_id', userId)
      .maybeSingle()

    const existingEnd = (existing as { current_period_end?: string | null } | null)
      ?.current_period_end
    const now = new Date()
    const startFrom = existingEnd && new Date(existingEnd) > now ? new Date(existingEnd) : now
    const periodEnd = new Date(startFrom)
    periodEnd.setUTCDate(periodEnd.getUTCDate() + PERIOD_DAYS[plan])

    const { error: subscriptionError } = await admin.from('subscriptions').upsert(
      {
        user_id: userId,
        provider: 'razorpay',
        plan,
        status: 'active',
        amount_cents: order.amount,
        provider_subscription_id: orderId,
        current_period_start: startFrom.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: 'user_id' },
    )

    // Checked rather than ignored: a silent failure here is how someone ends up
    // charged with no access.
    if (subscriptionError) throw subscriptionError

    // 6. Charity ledger, tagged with its source. A conflict here is expected
    //    rather than exceptional — it means a replay.
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

    const { error: ledgerError } = await admin.from('charity_contributions').insert({
      user_id: userId,
      charity_id: (profile as { charity_id?: string } | null)?.charity_id ?? null,
      subscription_id: (subscriptionRow as { id: string } | null)?.id ?? null,
      amount_cents: Math.round((order.amount * percentage) / 100),
      period_month: periodMonthFrom(now),
      provider_payment_id: paymentId,
      source: 'subscription',
    })

    if (ledgerError && !isDuplicate(ledgerError)) throw ledgerError

    return sendJson(res, 200, {
      activated: true,
      plan,
      periodStart: startFrom.toISOString(),
      periodEnd: periodEnd.toISOString(),
    })
  } catch (error) {
    console.error('verify-payment: failed', error)
    // errorMessage, not `error instanceof Error`: PostgrestError is a plain
    // object, so the instanceof check hid every database failure behind a
    // generic message and made this undiagnosable.
    return sendError(res, 500, errorMessage(error))
  }
}
