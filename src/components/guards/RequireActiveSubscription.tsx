import { LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { DataErrorPanel } from '@/components/guards/DataErrorPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/ui/spinner'
import { SubscriptionBadge } from '@/components/ui/status-badges'
import { PRICE_MONTHLY_CENTS, PRIZE_POOL_RATE } from '@/lib/constants'
import { errorText, isSessionRejected } from '@/lib/errors'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { formatCents } from '@/lib/utils'

/**
 * Wraps the paid areas of the app. Non-subscribers get an explanation and a
 * route to checkout rather than a dead end — the PRD asks for restricted access
 * to non-subscribers, not a broken experience.
 */
export function RequireActiveSubscription({ children }: { children: ReactNode }) {
  const { isLoading, subscription, isActive, error } = useSubscription()

  if (isLoading) return <FullPageSpinner label="Checking your subscription…" />

  // A failed read must not be presented as "no active plan" — that would tell the
  // user to subscribe when the real problem is that we could not read their row.
  if (error) {
    return <DataErrorPanel sessionRejected={isSessionRejected(error)} detail={errorText(error)} />
  }

  if (!isActive) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-16">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <LockKeyhole className="size-5 text-gold" />
              <CardTitle>An active subscription is required</CardTitle>
            </div>
            <CardDescription>
              {subscription
                ? 'Your subscription is not currently active. Renew to rejoin the monthly draw.'
                : 'You have not subscribed yet. Subscribe to enter your scores and join the monthly draw.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Current status</span>
              <SubscriptionBadge status={subscription?.status ?? 'inactive'} />
            </div>

            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              <li>· Enter your five latest Stableford scores</li>
              <li>· Every entry plays the monthly prize draw</li>
              <li>
                · {Math.round(PRIZE_POOL_RATE * 100)}% of your fee funds the prize pool, and at least
                10% goes to your chosen charity
              </li>
              <li>· From {formatCents(PRICE_MONTHLY_CENTS)} per month</li>
            </ul>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/subscription">Choose a plan</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/charities">Browse charities</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
