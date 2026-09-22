import crypto from 'node:crypto'

/** Our subscription lifecycle. Mirrors the `sub_status` enum in Postgres. */
export type SubStatus = 'inactive' | 'active' | 'past_due' | 'cancelled' | 'lapsed'

/**
 * Razorpay subscription lifecycle → our status.
 *
 * Razorpay drives renewal itself through the e-mandate it creates, so this
 * mapping is what makes the PRD's "renewal, cancellation, and
 * lapsed-subscription states" genuinely true rather than simulated: when a cycle
 * is charged again, `subscription.charged` arrives and the period moves forward
 * on its own.
 *
 * `authenticated` means the mandate is registered but no money has moved yet, so
 * it is deliberately NOT treated as active — otherwise a subscriber would be
 * entered into a draw before paying.
 *
 * `halted` and `paused` both mean collection stopped without a cancellation,
 * which is what `past_due` expresses. `completed` and `expired` mean the mandate
 * ran its course, so `lapsed`.
 */
export function mapStatus(status: string | undefined): SubStatus {
  switch (status) {
    case 'active':
      return 'active'
    case 'pending':
    case 'halted':
    case 'paused':
      return 'past_due'
    case 'cancelled':
      return 'cancelled'
    case 'completed':
    case 'expired':
      return 'lapsed'
    default:
      return 'inactive'
  }
}

/** Razorpay timestamps are Unix seconds; Postgres wants ISO strings. */
export function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null
}

/** First day of the month a payment belongs to, as `YYYY-MM-01`. */
export function periodMonthFrom(date: Date): string {
  return `${date.toISOString().slice(0, 8)}01`
}

/**
 * Constant-time string comparison.
 *
 * A plain `===` short-circuits on the first differing byte, which leaks the
 * expected digest to an attacker who can time responses. Length is compared
 * first because timingSafeEqual throws on mismatched lengths.
 */
export function safeEqual(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const providedBuffer = Buffer.from(provided, 'utf8')

  if (expectedBuffer.length !== providedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * Verifies the HMAC Razorpay sends in the `x-razorpay-signature` header, over
 * the untouched request body.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqual(expected, signature)
}

/**
 * Verifies the signature Razorpay returns to the browser after a payment on a
 * one-off order.
 *
 * Used by the donation flow, where the charge is a single payment rather than a
 * subscription. The signed string is `${order_id}|${payment_id}`. Without this
 * check anyone could POST a made-up payment id and record a donation.
 */
export function verifyPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
  secret: string
}): boolean {
  const { orderId, paymentId, signature, secret } = params
  if (!orderId || !paymentId || !signature) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  return safeEqual(expected, signature)
}
