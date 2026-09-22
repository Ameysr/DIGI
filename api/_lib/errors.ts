/**
 * Error formatting for the API functions.
 *
 * Worth its own module because the obvious version is wrong. Supabase's
 * `PostgrestError` is a plain object (`{ message, details, hint, code }`), NOT an
 * Error subclass, so `error instanceof Error` is false for every database
 * failure — and the message gets replaced by a useless generic string. That is
 * exactly how a foreign-key violation became "Payment verification failed."
 *
 * Razorpay's SDK is the other shape: it throws `{ statusCode, error: { code,
 * description } }`.
 */
export function errorMessage(error: unknown): string {
  const candidate = error as
    | { message?: string; description?: string; error?: { description?: string } }
    | null
    | undefined

  // First NON-EMPTY wins. A plain `??` chain would stop at an empty string —
  // `??` only falls through on null and undefined — and return '' as the message.
  const found = [
    candidate?.error?.description,
    candidate?.description,
    candidate?.message,
  ].find((value) => typeof value === 'string' && value.trim() !== '')

  return found ?? 'Unknown error'
}

/**
 * True when a write failed because the row already exists.
 *
 * Used for idempotency: a replayed webhook, a retried verification, or a
 * concurrent request all land here and should be treated as success rather than
 * as an error.
 */
export function isDuplicate(error: unknown): boolean {
  return (error as { code?: string } | null | undefined)?.code === '23505'
}
