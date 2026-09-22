import { ArrowRight, BadgeCheck, CalendarDays, HeartHandshake, Target, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NumberBallRow } from '@/components/draw/NumberBall'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, Stat } from '@/components/ui/stat'
import { PaymentBadge, SubscriptionBadge, TierBadge } from '@/components/ui/status-badges'
import { SCORE_LIMIT } from '@/lib/constants'
import { useCharities } from '@/lib/hooks/useCharities'
import { useMyEntries } from '@/lib/hooks/useDraws'
import { useProfile } from '@/lib/hooks/useProfile'
import { useScores } from '@/lib/hooks/useScores'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { useMyWinnings } from '@/lib/hooks/useWinners'
import { formatCents, formatDate } from '@/lib/utils'

function nextDrawMonth(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

export function Dashboard() {
  const { profile, isLoading: profileLoading } = useProfile()
  const { subscription, isActive, isLoading: subscriptionLoading } = useSubscription()
  const { data: scores, isLoading: scoresLoading } = useScores()
  const { data: entries, isLoading: entriesLoading } = useMyEntries(profile?.id)
  const { data: winnings, isLoading: winningsLoading } = useMyWinnings(profile?.id)
  const { data: charities } = useCharities()

  const charity = charities?.find((item) => item.id === profile?.charity_id) ?? null
  const scoreCount = scores?.length ?? 0
  const playedNumbers = [...(scores ?? [])].map((score) => score.value).sort((a, b) => a - b)

  const totalWonCents = (winnings ?? []).reduce((total, claim) => total + claim.prize_cents, 0)
  const unpaidCents = (winnings ?? [])
    .filter((claim) => claim.payment_status === 'pending')
    .reduce((total, claim) => total + claim.prize_cents, 0)

  const isLoading = profileLoading || subscriptionLoading

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-display text-3xl text-ink">
            {profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-muted">
            Everything about your entry: plan, scores, charity and winnings.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/scores">
            <Target />
            Manage scores
          </Link>
        </Button>
      </header>

      {!isLoading && !isActive ? (
        <Alert tone="warning" title="Your subscription is not active">
          You are not currently entered into the monthly draw.{' '}
          <Link to="/subscription" className="text-accent hover:underline">
            Choose a plan
          </Link>{' '}
          to rejoin.
        </Alert>
      ) : null}

      {/* ------------------------------------------------------- Key figures */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)
        ) : (
          <>
            <Stat
              label="Subscription"
              value={subscription?.plan ? `${subscription.plan} plan` : 'None'}
              hint={
                subscription?.current_period_end
                  ? `Renews ${formatDate(subscription.current_period_end)}`
                  : 'No renewal date yet'
              }
              icon={CalendarDays}
            />
            <Stat
              label="Scores logged"
              value={`${scoreCount} / ${SCORE_LIMIT}`}
              hint={scoreCount >= SCORE_LIMIT ? 'Eligible for the draw' : 'Not yet eligible'}
              icon={Target}
              tone={scoreCount >= SCORE_LIMIT ? 'accent' : 'default'}
            />
            <Stat
              label="Draws entered"
              value={entriesLoading ? '—' : (entries?.length ?? 0)}
              hint="Across all published draws"
              icon={Trophy}
            />
            <Stat
              label="Total won"
              value={winningsLoading ? '—' : formatCents(totalWonCents)}
              hint={unpaidCents > 0 ? `${formatCents(unpaidCents)} awaiting payment` : 'All settled'}
              icon={BadgeCheck}
              tone="gold"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------------------------------------------- Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Subscription</CardTitle>
              {subscriptionLoading ? <Skeleton className="h-6 w-20" /> : <SubscriptionBadge status={subscription?.status ?? 'inactive'} />}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Plan" value={subscription?.plan ?? '—'} />
            <Row
              label="Amount"
              value={subscription ? formatCents(subscription.amount_cents) : '—'}
            />
            <Row
              label="Current period ends"
              value={
                subscription?.current_period_end
                  ? formatDate(subscription.current_period_end)
                  : '—'
              }
            />
            <Button asChild variant="secondary" size="sm" className="mt-2 self-start">
              <Link to="/subscription">
                Manage subscription
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* --------------------------------------------------------- Charity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Your charity</CardTitle>
              <HeartHandshake className="size-4 text-gold" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {profileLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : charity ? (
              <>
                <p className="text-base font-medium text-ink">{charity.name}</p>
                <p className="text-muted">{charity.short_blurb}</p>
                <Row label="Contribution" value={`${Number(profile?.charity_percentage ?? 0)}%`} />
                <Button asChild variant="ghost" size="sm" className="mt-1 self-start px-0">
                  <Link to="/charity">
                    Change charity
                    <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-muted">
                  You have not chosen a charity yet. Your subscription still enters the draw, but no
                  contribution is being directed.
                </p>
                <Button asChild size="sm">
                  <Link to="/charity">Choose a charity</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------- Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Your numbers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {scoresLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : playedNumbers.length > 0 ? (
              <>
                <NumberBallRow values={playedNumbers} tone="accent" />
                <p className="text-xs text-muted">
                  These are your latest {playedNumbers.length} scores, and the numbers they become in
                  the draw. They refresh automatically as you log more rounds.
                </p>
              </>
            ) : (
              <EmptyState
                icon={Target}
                title="No scores yet"
                description={`Log ${SCORE_LIMIT} rounds to be entered into the draw.`}
                action={
                  <Button asChild size="sm">
                    <Link to="/scores">Add a score</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* --------------------------------------------------- Participation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Participation</CardTitle>
              <Badge tone="muted">
                Next draw {formatDate(nextDrawMonth())}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {entriesLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : entries && entries.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {entries.slice(0, 4).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-ink">{formatDate(entry.created_at)}</span>
                      <span className="text-xs text-muted">
                        {entry.matched_count} number{entry.matched_count === 1 ? '' : 's'} matched
                      </span>
                    </div>
                    {entry.prize_tier ? (
                      <TierBadge tier={entry.prize_tier} />
                    ) : (
                      <Badge tone="muted">No prize</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                You have not been entered into a draw yet. Once you hold {SCORE_LIMIT} scores, the
                next monthly draw includes you automatically.
              </p>
            )}
            <Button asChild variant="ghost" size="sm" className="self-start px-0">
              <Link to="/draws">
                See all draws
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------------- Winnings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Winnings</CardTitle>
            <Button asChild variant="ghost" size="sm" className="px-0">
              <Link to="/winnings">
                Manage claims
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {winningsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : winnings && winnings.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {winnings.map((claim) => (
                <li key={claim.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-ink">
                      {formatCents(claim.prize_cents)} · {formatDate(claim.created_at)}
                    </span>
                    <TierBadge tier={claim.prize_tier} />
                  </div>
                  <PaymentBadge status={claim.payment_status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No winnings yet. When you win, the claim and its payment status appear here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-medium capitalize text-ink">{value}</span>
    </div>
  )
}
