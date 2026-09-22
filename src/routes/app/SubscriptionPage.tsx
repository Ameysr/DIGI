import { useQueryClient } from '@tanstack/react-query'
import { CalendarX2, Check } from 'lucide-react'
import { useState } from 'react'
import { DataErrorPanel } from '@/components/guards/DataErrorPanel'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { SubscriptionBadge } from '@/components/ui/status-badges'
import { postJson } from '@/lib/api'
import {
  CHARITY_PERCENTAGE_MIN,
  PLANS,
  PRIZE_POOL_RATE,
  type PlanId,
  YEARLY_SAVING_PERCENT,
} from '@/lib/constants'
import { queryKeys } from '@/lib/queryClient'
import { errorText, isSessionRejected } from '@/lib/errors'
import { useAuth } from '@/lib/auth/context'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { openRazorpayCheckout } from '@/lib/razorpay'
import { getAccessToken } from '@/lib/supabase/client'
import { formatCents, formatDate } from '@/lib/utils'

/**
 * The server decides the payment shape, because whether this Razorpay account can
 * sell auto-renewing subscriptions is a property of the account, not of the UI.
 */
type BillingResponse =
  | { mode: 'subscription'; subscriptionId: string; keyId: string; plan: PlanId; amount: number }
  | {
      mode: 'order'
      order: { id: string; amount: number; currency: string }
      keyId: string
      plan: PlanId
    }

export function SubscriptionPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { subscription, status, isActive, hasLapsed, isLoading, error: queryError } = useSubscription()

  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const endsAtPeriodEnd = Boolean(subscription?.cancel_at_period_end)

  async function refreshSubscription() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.subscription(subscription?.user_id) })
  }

  // This page sits outside both route guards, so it has to make the same
  // distinction itself. Any error must be shown: rendering a failed read as "no
  // plan" told the user they were unsubscribed when they were in fact subscribed
  // and we simply could not read the row.
  if (queryError) {
    return (
      <DataErrorPanel sessionRejected={isSessionRejected(queryError)} detail={errorText(queryError)} />
    )
  }

  /**
   * Starts a plan purchase.
   *
   * The server decides whether this account can sell auto-renewing subscriptions
   * or has to fall back to a single charge, and tells us which via `mode`. Both
   * open Razorpay's modal, so card details never reach this application.
   *
   * Note what does NOT happen: the browser never decides that a payment
   * succeeded. In subscription mode the webhook is authoritative and the handler
   * only refetches. In order mode the handler posts the signature back and the
   * server verifies it before anything is activated.
   */
  async function startCheckout(plan: PlanId) {
    setError(null)
    setConfirmed(false)
    setPendingPlan(plan)

    try {
      const token = await getAccessToken()
      const result = await postJson<BillingResponse>('/api/billing', { plan }, token)

      const shared = {
        key: result.keyId,
        name: 'Digital Heroes',
        description: `${plan === 'monthly' ? 'Monthly' : 'Yearly'} subscription`,
        prefill: {
          email: user?.email ?? undefined,
          name: user?.fullName ?? undefined,
        },
        theme: { color: '#34d399' },
        method: { netbanking: true, card: true, upi: true, wallet: true },
        modal: { ondismiss: () => setPendingPlan(null) },
      }

      const opened = await openRazorpayCheckout(
        result.mode === 'subscription'
          ? {
              ...shared,
              amount: result.amount,
              currency: 'INR',
              subscription_id: result.subscriptionId,
              handler: async () => {
                setConfirmed(true)
                setPendingPlan(null)
                // Razorpay's webhook lands just after this callback, so refetch
                // shortly rather than immediately reporting still-inactive.
                window.setTimeout(() => void refreshSubscription(), 1500)
              },
            }
          : {
              ...shared,
              amount: result.order.amount,
              currency: result.order.currency,
              order_id: result.order.id,
              handler: async (response) => {
                try {
                  await postJson(
                    '/api/verify-payment',
                    {
                      orderId: response.razorpay_order_id,
                      paymentId: response.razorpay_payment_id,
                      signature: response.razorpay_signature,
                    },
                    token,
                  )
                  setConfirmed(true)
                } catch (cause) {
                  // The charge may well have succeeded, so say so plainly rather
                  // than implying it failed.
                  setError(
                    `Your payment went through, but we could not confirm it automatically: ${
                      cause instanceof Error ? cause.message : 'unknown error'
                    } — refresh in a moment, and contact support if it does not appear.`,
                  )
                } finally {
                  setPendingPlan(null)
                  await refreshSubscription()
                }
              },
            },
      )

      if (!opened) {
        setError('Could not load the payment processor. Check your connection and try again.')
        setPendingPlan(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start checkout.')
      setPendingPlan(null)
    }
  }

  async function handleCancel() {
    setError(null)
    setCancelling(true)
    try {
      const token = await getAccessToken()
      await postJson<{ cancelled: boolean }>('/api/billing', { action: 'cancel' }, token)
      setConfirmCancel(false)
      await refreshSubscription()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not cancel the subscription.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">Subscription</h1>
        <p className="max-w-2xl text-sm text-muted">
          Your plan enters you into every monthly draw and funds the charity you chose.
        </p>
      </header>

      {confirmed ? (
        <Alert tone="success" title="Payment received">
          Your subscription activates as soon as Razorpay confirms the mandate — usually within a
          few seconds, because they start charging it automatically from here on. If the status
          below still shows inactive, give it a moment and refresh.
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      ) : null}

      {/* ------------------------------------------------------------ Status */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Current status</CardTitle>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <SubscriptionBadge status={status} />
                {endsAtPeriodEnd && isActive ? <Badge tone="gold">Ending</Badge> : null}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Detail label="Plan" value={subscription?.plan ?? 'None'} />
              <Detail
                label="Amount"
                value={subscription ? formatCents(subscription.amount_cents) : '—'}
              />
              <Detail
                label={endsAtPeriodEnd ? 'Ends' : 'Access until'}
                value={
                  subscription?.current_period_end
                    ? formatDate(subscription.current_period_end)
                    : '—'
                }
              />
            </div>
          )}

          {hasLapsed ? (
            <Alert tone="warning" title="Your plan has lapsed">
              The period you paid for has ended, so you are no longer entered into the monthly
              draw. Pay again below to rejoin — your scores and charity choice are kept.
            </Alert>
          ) : null}

          {isActive && endsAtPeriodEnd ? (
            <Alert tone="warning" title="Cancellation scheduled">
              Your subscription ends on{' '}
              {subscription?.current_period_end
                ? formatDate(subscription.current_period_end)
                : 'the end of the current period'}
              . You keep full access — including draw entry — until then.
            </Alert>
          ) : null}

          {isActive && !endsAtPeriodEnd ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                <CalendarX2 />
                Cancel subscription
              </Button>
              <p className="text-xs text-muted">
                Your plan does not renew automatically, so this simply records that you do not
                intend to continue. You keep access until the period ends.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- Plans */}
      <div className="grid gap-5 md:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent = subscription?.plan === plan.id && isActive && !endsAtPeriodEnd
          const isBusy = pendingPlan === plan.id
          const action = isCurrent ? 'Your current plan' : hasLapsed ? 'Renew' : 'Subscribe'

          return (
            <Card key={plan.id} className={plan.highlight ? 'border-accent/30' : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{plan.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    {plan.highlight ? (
                      <Badge tone="accent">Save {YEARLY_SAVING_PERCENT}%</Badge>
                    ) : null}
                    {isCurrent ? <Badge tone="muted">Current</Badge> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div>
                  <p className="text-3xl font-semibold tabular-nums text-ink">
                    {formatCents(plan.priceCents)}
                  </p>
                  <p className="text-sm text-muted">{plan.cadence}</p>
                </div>

                <p className="text-sm text-muted">{plan.blurb}</p>

                <ul className="flex flex-col gap-2 text-sm text-muted">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-accent" />
                    {Math.round(PRIZE_POOL_RATE * 100)}% of your fee funds the prize pool
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-accent" />
                    At least {CHARITY_PERCENTAGE_MIN}% goes to your charity
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-accent" />
                    Entered into every monthly draw
                  </li>
                </ul>

                <Button
                  onClick={() => startCheckout(plan.id)}
                  disabled={pendingPlan !== null || isCurrent}
                  variant={plan.highlight ? 'primary' : 'secondary'}
                >
                  {isBusy ? <Spinner /> : null}
                  {isCurrent
                    ? action
                    : `${action} ${plan.id === 'monthly' ? 'monthly' : 'yearly'}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted">
        Payments are handled by Razorpay. This build runs in test mode — no real money moves. Use
        Razorpay&rsquo;s test cards, starting with 4111 1111 1111 1111 with any future expiry date.
      </p>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent
          title="Cancel your subscription?"
          description="You will keep access until the end of the period you have already paid for. After that you will be removed from the monthly draw."
        >
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep my subscription
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Spinner /> : null}
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="font-medium capitalize text-ink">{value}</span>
    </div>
  )
}
