/**
 * Server-side environment access.
 *
 * Read lazily inside handlers rather than at module load: a missing variable
 * should produce a clear 500 for that one request, not crash the function on
 * cold start with an unhelpful module-resolution error.
 *
 * NOTE: VITE_SUPABASE_URL is reused on the server. Vercel exposes every
 * environment variable to Node functions, and the project URL is not a secret —
 * duplicating it as a second variable would just be one more thing to keep in
 * sync.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function serverEnv() {
  return {
    supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    siteUrl: process.env.SITE_URL ?? 'http://localhost:5173',
  }
}

/**
 * Razorpay configuration.
 *
 * The two plan ids are OPTIONAL, and that is deliberate. Plans are what let a
 * subscription renew itself, but Razorpay gates the Subscriptions product behind
 * account activation on some accounts — where it is unavailable, `POST /v1/plans`
 * and `/v1/subscriptions` both return 401 while `/v1/orders` returns 200.
 *
 * So the mode is detected rather than configured:
 *   both plan ids set  → auto-renewing Razorpay subscription (satisfies §04)
 *   otherwise          → one-off orders, which work on any account but do not
 *                        renew on their own
 *
 * Setting the plan ids later is the only change needed to switch modes.
 */
export function razorpayEnv() {
  return {
    keyId: requireEnv('RAZORPAY_KEY_ID'),
    keySecret: requireEnv('RAZORPAY_KEY_SECRET'),
    // Optional; only read in subscription mode.
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
    planMonthly: process.env.RAZORPAY_PLAN_MONTHLY ?? '',
    planYearly: process.env.RAZORPAY_PLAN_YEARLY ?? '',
  }
}

/** True when this account can sell auto-renewing subscriptions. */
export function supportsSubscriptions(): boolean {
  const { planMonthly, planYearly } = razorpayEnv()
  return Boolean(planMonthly && planYearly)
}
