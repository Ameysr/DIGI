import Razorpay from 'razorpay'
import { getUserId } from './_lib/auth'
import { errorMessage } from './_lib/errors'
import { razorpayEnv, supportsSubscriptions } from './_lib/env'
import { readJsonBody, sendError, sendJson, type ApiRequest, type ApiResponse } from './_lib/http'
import { PRICE_MONTHLY_PAISE, PRICE_YEARLY_PAISE } from './_lib/pricing'
import { ensureProfile } from './_lib/profiles'
import { supabaseAdmin } from './_lib/supabaseAdmin'

const PRICE_PAISE = {
  monthly: PRICE_MONTHLY_PAISE,
  yearly: PRICE_YEARLY_PAISE,
} as const

type PlanId = keyof typeof PRICE_PAISE

/**
 * Billing cycles bought up front when selling a subscription. Razorpay requires
 * an explicit total_count, so this is how many cycles run before it completes on
 * its own. Set generously — a subscriber can cancel at any time.
 */
const TOTAL_COUNT = {
  monthly: 60, // five years of monthly cycles
  yearly: 10, // ten annual cycles
} as const

type BillingBody = {
  plan?: PlanId
  action?: 'cancel'
}

/**
 * Starts a plan purchase, or cancels the current one.
 *
 * TWO MODES, detected from configuration rather than declared:
 *
 *  subscription — auto-renewing. Razorpay holds an e-mandate and charges each
 *                 cycle itself, and its webhook drives our status. This is what
 *                 the PRD's "handles renewal" asks for.
 *  order        — a single charge. Works on any Razorpay account, including ones
 *                 where the Subscriptions product is not enabled, but nothing
 *                 renews: the period simply runs out and the subscriber pays
 *                 again from the subscription screen.
 *
 * The response carries `mode` so the browser knows which checkout to open. Both
 * modes open Razorpay's modal, so card details never reach this application.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed')
  }

  try {
    const userId = await getUserId(req)
    if (!userId) {
      return sendError(res, 401, 'You must be signed in to manage a subscription.')
    }

    // The pending subscription row references profiles, and the trigger that
    // creates those only runs at signup. Creating it here means the server never
    // depends on someone else having done so first.
    await ensureProfile(userId)

    const body = await readJsonBody<BillingBody>(req)
    const config = razorpayEnv()
    const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret })
    const admin = supabaseAdmin()
    const subscriptionMode = supportsSubscriptions()

    const { data: existing } = await admin
      .from('subscriptions')
      .select('id, status, provider_subscription_id, cancel_at_period_end')
      .eq('user_id', userId)
      .maybeSingle()

    const current = existing as
      | {
          id: string
          status: string
          provider_subscription_id: string | null
          cancel_at_period_end: boolean
        }
      | null

    // ------------------------------------------------------------- Cancel
    if (body.action === 'cancel') {
      if (!current) {
        return sendError(res, 400, 'There is no subscription to cancel.')
      }
      if (current.status !== 'active' && current.status !== 'past_due') {
        return sendError(res, 400, 'Only an active subscription can be cancelled.')
      }
      if (current.cancel_at_period_end) {
        return sendError(res, 400, 'This subscription is already scheduled to end.')
      }

      // In subscription mode Razorpay owns the mandate, so it has to be told to
      // stop. In order mode nothing renews, so there is nothing to call.
      if (subscriptionMode && current.provider_subscription_id) {
        await razorpay.subscriptions.cancel(current.provider_subscription_id, true)
      }

      await admin
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          // With no mandate behind it, cancelling is immediate intent: the period
          // still runs to its end, and `applyPeriod` lapses it afterwards.
          ...(subscriptionMode ? {} : { status: 'cancelled' as const }),
        })
        .eq('user_id', userId)

      return sendJson(res, 200, { cancelled: true, mode: subscriptionMode ? 'subscription' : 'order' })
    }

    // ---------------------------------------------------------- Subscribe
    const plan = body.plan
    if (plan !== 'monthly' && plan !== 'yearly') {
      return sendError(res, 400, 'Choose either the monthly or the yearly plan.')
    }

    if (current?.status === 'active') {
      return sendError(res, 400, 'You already have an active subscription.')
    }

    const pending = {
      user_id: userId,
      provider: 'razorpay',
      plan,
      status: 'inactive' as const,
      amount_cents: PRICE_PAISE[plan],
      cancel_at_period_end: false,
    }

    // ------------------------------------------------- Auto-renewing plan
    if (subscriptionMode) {
      const subscription = await razorpay.subscriptions.create({
        plan_id: plan === 'monthly' ? config.planMonthly : config.planYearly,
        total_count: TOTAL_COUNT[plan],
        quantity: 1,
        customer_notify: 1,
        // Load-bearing: the webhook reads these back to tie the Razorpay
        // subscription to a user.
        notes: { user_id: userId, plan },
      })

      const subscriptionId = (subscription as { id?: string }).id
      if (!subscriptionId) {
        return sendError(res, 500, 'Razorpay did not return a subscription id.')
      }

      await admin
        .from('subscriptions')
        .upsert({ ...pending, provider_subscription_id: subscriptionId }, { onConflict: 'user_id' })

      return sendJson(res, 200, {
        mode: 'subscription' as const,
        subscriptionId,
        keyId: config.keyId,
        plan,
        amount: PRICE_PAISE[plan],
      })
    }

    // ------------------------------------------- Single charge (fallback)
    const order = await razorpay.orders.create({
      amount: PRICE_PAISE[plan],
      currency: 'INR',
      // Razorpay caps receipt at 40 characters.
      receipt: `dh_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}_${Date.now().toString(36)}`,
      // Read back by /api/verify-payment, so the plan and the owner come from
      // Razorpay rather than from the request.
      notes: { purpose: 'subscription', user_id: userId, plan },
    })

    await admin
      .from('subscriptions')
      .upsert({ ...pending, provider_subscription_id: order.id }, { onConflict: 'user_id' })

    return sendJson(res, 200, {
      mode: 'order' as const,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      keyId: config.keyId,
      plan,
    })
  } catch (error) {
    console.error('billing: request failed', error)
    return sendError(res, 500, errorMessage(error))
  }
}
