import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postJson } from '@/lib/api'
import { openRazorpayCheckout, type RazorpayPaymentResponse } from '@/lib/razorpay'
import { getAccessToken } from '@/lib/supabase/client'

type CreateOrderResponse = {
  order: { id: string; amount: number; currency: string }
  keyId: string
}

/**
 * An independent donation — PRD §08.1, "not tied to gameplay".
 *
 * Three steps, all hidden behind one mutation so the calling component just gets
 * a promise: create an order, open Razorpay Checkout, then hand the result back
 * to the server to verify. The client never decides that a payment succeeded —
 * `/api/donations` checks the signature and re-reads the order from Razorpay.
 */
export function useDonate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      charityId,
      amountCents,
    }: {
      charityId: string
      amountCents: number
    }): Promise<void> => {
      // The browser does not need this for Supabase itself — supabase-js attaches
      // the session automatically — but our own /api functions verify the caller
      // independently, so they need it in a header.
      const token = await getAccessToken()

      const { order, keyId } = await postJson<CreateOrderResponse>(
        '/api/donations',
        { action: 'create', charityId, amountCents },
        token,
      )

      // The payment callbacks are push-based, so bridge them into a promise that
      // settles once the modal either completes or is dismissed.
      await new Promise<void>((resolve, reject) => {
        openRazorpayCheckout({
          key: keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'Digital Heroes',
          description: 'Charity donation',
          order_id: order.id,
          theme: { color: '#34d399' },
          method: { netbanking: true, card: true, upi: true, wallet: true },
          modal: {
            ondismiss: () => reject(new Error('Donation cancelled.')),
          },
          handler: async (response: RazorpayPaymentResponse) => {
            try {
              await postJson(
                '/api/donations',
                {
                  action: 'verify',
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                },
                token,
              )
              resolve()
            } catch (cause) {
              reject(cause instanceof Error ? cause : new Error('Verification failed.'))
            }
          },
        })
          .then((opened) => {
            if (!opened) reject(new Error('Could not load the payment processor.'))
          })
          .catch(reject)
      })
    },
    onSuccess: () => {
      // Contributions are part of the ledger the admin reports on, so both the
      // donor's history and the admin totals need refreshing.
      void queryClient.invalidateQueries({ queryKey: ['contributions'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}
