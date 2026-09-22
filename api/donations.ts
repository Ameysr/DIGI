import Razorpay from 'razorpay'
import { getUserId } from './_lib/auth'
import { errorMessage, isDuplicate } from './_lib/errors'
import { razorpayEnv } from './_lib/env'
import { readJsonBody, sendError, sendJson, type ApiRequest, type ApiResponse } from './_lib/http'
import { DONATION_MAX_PAISE, DONATION_MIN_PAISE } from './_lib/pricing'
import { ensureProfile } from './_lib/profiles'
import { periodMonthFrom, verifyPaymentSignature } from './_lib/razorpay'
import { supabaseAdmin } from './_lib/supabaseAdmin'

type DonationBody = {
  action: 'create' | 'verify'
  /** action: 'create' */
  charityId?: string
  amountCents?: number
  /** action: 'verify' */
  orderId?: string
  paymentId?: string
  signature?: string
}

/**
 * Independent donations — PRD §08.1, "not tied to gameplay".
 *
 * A one-off gift to a chosen charity, separate from the subscription and with no
 * bearing on scores or the draw. Two steps in one endpoint because they are
 * halves of one flow:
 *
 *   create  → a Razorpay order for the chosen amount
 *   verify  → check the signature, then record it in the contribution ledger
 *
 * Orders rather than subscriptions here, which is the opposite of the plan flow
 * and correct for it: a donation is a single charge, so there is nothing to
 * renew and no mandate to hold.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed')
  }

  try {
    // Donations require an account. A gift has to be attributable to someone for
    // the ledger — and the charity — to be auditable.
    const userId = await getUserId(req)
    if (!userId) {
      return sendError(res, 401, 'You must be signed in to donate.')
    }

    // The ledger row references profiles, and a donor's profile may not exist yet
    // if they predate the signup trigger.
    await ensureProfile(userId)

    const body = await readJsonBody<DonationBody>(req)
    const config = razorpayEnv()
    const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret })
    const admin = supabaseAdmin()

    // ------------------------------------------------------------- Create
    if (body.action === 'create') {
      const charityId = body.charityId
      const amount = Number(body.amountCents)

      if (!charityId) {
        return sendError(res, 400, 'Choose a charity to support.')
      }
      if (!Number.isInteger(amount) || amount < DONATION_MIN_PAISE || amount > DONATION_MAX_PAISE) {
        return sendError(
          res,
          400,
          `Enter an amount between ₹${DONATION_MIN_PAISE / 100} and ₹${DONATION_MAX_PAISE / 100}.`,
        )
      }

      // The charity must exist and be public, so a donation cannot be pointed at
      // a hidden or deleted row.
      const { data: charity } = await admin
        .from('charities')
        .select('id')
        .eq('id', charityId)
        .eq('is_active', true)
        .maybeSingle()

      if (!charity) {
        return sendError(res, 400, 'That charity is not available.')
      }

      const order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        // Razorpay caps receipt at 40 characters.
        receipt: `dh_don_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}_${Date.now().toString(36)}`,
        notes: {
          purpose: 'donation',
          user_id: userId,
          charity_id: charityId,
        },
      })

      return sendJson(res, 200, {
        order: { id: order.id, amount: order.amount, currency: order.currency },
        keyId: config.keyId,
      })
    }

    // ------------------------------------------------------------- Verify
    if (body.action === 'verify') {
      const { orderId, paymentId, signature } = body
      if (!orderId || !paymentId || !signature) {
        return sendError(res, 400, 'orderId, paymentId and signature are all required.')
      }

      // Signature first — until it passes, nothing else matters.
      const valid = verifyPaymentSignature({
        orderId,
        paymentId,
        signature,
        secret: config.keySecret,
      })

      if (!valid) {
        console.error('donations: signature mismatch', { orderId, paymentId, userId })
        return sendError(res, 400, 'Invalid payment signature.')
      }

      // Read the order back from Razorpay rather than trusting the request, so
      // the charity and the amount are the gateway's values, not the browser's.
      const order = (await razorpay.orders.fetch(orderId)) as {
        id: string
        amount: number
        notes?: Record<string, string> | null
      }

      if (order.notes?.purpose !== 'donation') {
        return sendError(res, 400, 'That order is not a donation.')
      }
      if (order.notes?.user_id !== userId) {
        console.error('donations: order belongs to another user', { orderId, userId })
        return sendError(res, 403, 'That order does not belong to your account.')
      }
      if (order.amount < DONATION_MIN_PAISE || order.amount > DONATION_MAX_PAISE) {
        return sendError(res, 400, 'That order amount is outside the permitted range.')
      }

      const charityId = order.notes?.charity_id
      if (!charityId) {
        return sendError(res, 400, 'That order is missing its charity.')
      }

      // Written to the same ledger as subscription contributions, tagged with its
      // source, so admin totals include it without special casing.
      const { error: ledgerError } = await admin.from('charity_contributions').insert({
        user_id: userId,
        charity_id: charityId,
        subscription_id: null,
        amount_cents: order.amount,
        period_month: periodMonthFrom(new Date()),
        provider_payment_id: paymentId,
        source: 'donation',
      })

      // 23505 means this payment is already recorded — a retry, not a failure.
      if (ledgerError && !isDuplicate(ledgerError)) throw ledgerError

      return sendJson(res, 200, { recorded: true, amountCents: order.amount })
    }

    return sendError(res, 400, 'Unknown action.')
  } catch (error) {
    console.error('donations: request failed', error)
    return sendError(res, 500, errorMessage(error))
  }
}
