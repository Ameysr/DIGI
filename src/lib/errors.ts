/**
 * Turns Postgres error codes into something a person can act on.
 *
 * The database is the thing enforcing the rules (score range, one score per
 * date, no future rounds, admin-only transitions), so its errors are the ones
 * users actually hit. Translating them here keeps that wording in one place
 * instead of scattered across every form.
 */
export function describeDbError(error: unknown): string {
  const candidate = error as { code?: string; message?: string } | null | undefined

  switch (candidate?.code) {
    case '23505':
      return 'You already logged a score for that date. Edit the existing entry instead.'
    case '23514':
      return 'That value is outside the allowed range. Scores must be between 1 and 45.'
    case '22007':
      return 'A score cannot be dated in the future.'
    case '42501':
      return 'You do not have permission to do that.'
    case 'P0002':
      return 'That record no longer exists.'
    default:
      return candidate?.message ?? 'Something went wrong. Please try again.'
  }
}

/** Throws a normalised Error so react-query surfaces a readable message. */
export function assertNoError(error: { message: string; code?: string } | null): void {
  if (error) throw error
}

/**
 * True when Supabase rejected the request because it could not authenticate the
 * caller — as opposed to the row simply not existing, or a policy filtering it.
 *
 * This distinction matters for the UI. A rejected session and a missing row both
 * produce "no data", and without separating them the app reports the wrong thing:
 * an unauthenticated request to `profiles` comes back as "permission denied",
 * which the guards would otherwise present as "you are not an administrator" —
 * pointing at entirely the wrong problem.
 *
 * TWO error shapes matter here, and missing the second one caused a real bug:
 *
 *   42501     — insufficient privilege. What Postgres returns when RLS denies.
 *   PGRST301  — "No suitable key or wrong key type". What Supabase returns when
 *               it cannot DECODE the JWT at all, which is the signature of a
 *               misconfigured third-party auth integration. It carries no
 *               `status` field, so a status-based check misses it entirely.
 */
export function isSessionRejected(error: unknown): boolean {
  const candidate = error as { code?: string; status?: number; message?: string } | null | undefined
  if (!candidate) return false

  if (candidate.code === '42501') return true
  if (candidate.code === 'PGRST301') return true
  if (candidate.status === 401 || candidate.status === 403) return true

  return (
    typeof candidate.message === 'string' &&
    /permission denied|invalid jwt|jwt verification|no suitable key|wrong key type|unauthorized/i.test(
      candidate.message,
    )
  )
}

/**
 * A readable message for any thrown shape.
 *
 * Supabase's PostgrestError is a plain object, not an Error, so
 * `error instanceof Error ? error.message` loses it. Same trap as on the server.
 */
export function errorText(error: unknown): string {
  const candidate = error as { message?: string; error?: { description?: string } } | null | undefined
  return candidate?.error?.description ?? candidate?.message ?? ''
}
