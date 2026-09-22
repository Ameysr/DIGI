/**
 * Razorpay Checkout loader.
 *
 * The script is injected on demand rather than added to index.html, so it never
 * loads for the visitors who are not paying. Calling it twice shares one request.
 */

export type RazorpayPaymentResponse = {
  razorpay_order_id?: string
  razorpay_subscription_id?: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  /** Exactly one of these: an order for a one-off charge, a subscription for a mandate. */
  order_id?: string
  subscription_id?: string
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>
  prefill?: { name?: string; email?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  modal?: { ondismiss?: () => void; escape?: boolean }
  method?: Record<string, boolean>
}

type RazorpayInstance = { open: () => void }

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let inFlight: Promise<boolean> | null = null

/** Injects Razorpay's checkout script once, and reports whether it is ready. */
export function loadRazorpayCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  if (inFlight) return inFlight

  inFlight = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)

    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  }).then((ready) => {
    // Do not cache a failure — a user on a flaky connection should be able to
    // try again without reloading the page.
    if (!ready) inFlight = null
    return ready
  })

  return inFlight
}

/** Opens the Razorpay modal. Resolves false when the script could not load. */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<boolean> {
  const ready = await loadRazorpayCheckout()
  if (!ready || !window.Razorpay) return false

  new window.Razorpay(options).open()
  return true
}
