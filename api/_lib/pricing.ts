/**
 * Plan prices for the API layer, in the smallest currency unit (paise).
 *
 * MIRRORS `PRICE_MONTHLY_CENTS` / `PRICE_YEARLY_CENTS` in src/lib/constants.ts.
 * The API cannot import from src — Vercel compiles these functions separately and
 * does not resolve the `@/` path alias — so the values are duplicated here.
 *
 * The authoritative price is the one on the Razorpay plan; this copy exists only
 * so a pending subscription row has a sensible amount before the first webhook
 * arrives. If you change a price, change it in three places: here, the constants
 * file, and the Razorpay dashboard.
 */
export const PRICE_MONTHLY_PAISE = 49900 // ₹499
export const PRICE_YEARLY_PAISE = 499900 // ₹4,999

/**
 * Bounds for an independent donation, in paise.
 *
 * A floor because sub-₹100 card charges are mostly eaten by fees, and a ceiling
 * because an unbounded field on a payment form is how you end up with a typo
 * charging someone a lakh.
 */
export const DONATION_MIN_PAISE = 10_000 // ₹100
export const DONATION_MAX_PAISE = 10_000_000 // ₹1,00,000
