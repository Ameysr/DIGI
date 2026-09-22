import {
  ArrowRight,
  CalendarDays,
  HeartHandshake,
  Sparkles,
  Target,
  Ticket,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Reveal } from '@/components/motion/Reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CHARITY_PERCENTAGE_MIN,
  PRIZE_POOL_RATE,
  PRIZE_TIERS,
  PRICE_MONTHLY_CENTS,
  PRICE_YEARLY_CENTS,
  SCORE_LIMIT,
  TIER_LABELS,
  TIER_SPLITS,
  YEARLY_SAVING_PERCENT,
} from '@/lib/constants'
import { useFeaturedCharity } from '@/lib/hooks/useCharities'
import { formatCents } from '@/lib/utils'

const STEPS = [
  {
    icon: Ticket,
    title: 'Subscribe',
    body: 'Pick monthly or yearly. A fixed share of your fee becomes the prize pool for that month.',
  },
  {
    icon: Target,
    title: `Log your last ${SCORE_LIMIT} scores`,
    body: `Enter each round in Stableford format, 1 to 45. We keep your five most recent rounds, which become the numbers you play.`,
  },
  {
    icon: Trophy,
    title: 'Win the monthly draw',
    body: 'Match three, four or all five numbers to win. Unclaimed jackpots roll into the following month.',
  },
]

export function Home() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedCharity()

  const charityShare = CHARITY_PERCENTAGE_MIN
  const platformShare = 100 - charityShare - PRIZE_POOL_RATE * 100

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Reveal>
              <Badge tone="accent" className="mb-6">
                <Sparkles />
                Monthly draw · charity-first
              </Badge>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="text-display text-4xl text-ink sm:text-5xl lg:text-6xl">
                Play your round.
                <br />
                Win the draw.{' '}
                <span className="text-gradient">Fund the cause you choose.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-base text-muted sm:text-lg">
                Subscribe, log your last {SCORE_LIMIT} rounds, and every month your scores go into a
                prize draw. At least {CHARITY_PERCENTAGE_MIN}% of your fee reaches your chosen
                charity — before a single number is drawn.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/signup">
                    Subscribe from {formatCents(PRICE_MONTHLY_CENTS)}/mo
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="mt-5 text-sm text-muted">
                Yearly works out {YEARLY_SAVING_PERCENT}% cheaper at{' '}
                {formatCents(PRICE_YEARLY_CENTS)}. Cancel whenever you like.
              </p>
            </Reveal>
          </div>

          {/* Money split, shown rather than described. */}
          <Reveal delay={0.15}>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <CardTitle>Where your fee goes</CardTitle>
                <Badge tone="muted">per month</Badge>
              </div>

              <p className="mt-5 text-3xl font-semibold text-ink tabular-nums">
                {formatCents(PRICE_MONTHLY_CENTS)}
              </p>

              <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-accent"
                  style={{ width: `${PRIZE_POOL_RATE * 100}%` }}
                  aria-hidden
                />
                <div
                  className="bg-gold"
                  style={{ width: `${charityShare}%` }}
                  aria-hidden
                />
                <div className="flex-1 bg-white/[0.12]" aria-hidden />
              </div>

              <ul className="mt-5 flex flex-col gap-3 text-sm">
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="size-2.5 rounded-full bg-accent" />
                    Prize pool
                  </span>
                  <span className="font-medium text-ink">
                    {Math.round(PRIZE_POOL_RATE * 100)}%
                  </span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="size-2.5 rounded-full bg-gold" />
                    Your charity
                  </span>
                  <span className="font-medium text-ink">{charityShare}%+</span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="size-2.5 rounded-full bg-white/20" />
                    Running the platform
                  </span>
                  <span className="font-medium text-ink">{platformShare}%</span>
                </li>
              </ul>

              <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
                You can raise your charity share any time, up to 50% — the pool stays fixed so prizes
                remain predictable.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------- How it works */}
      <section id="how" className="scroll-mt-24 border-t border-line/60 px-5 py-20 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="text-display text-3xl text-ink sm:text-4xl">Three steps, every month</h2>
            <p className="mt-4 max-w-2xl text-muted">
              No handicap paperwork and no club membership. If you play, you are in.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.08}>
                <Card className="h-full p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent/12 text-accent">
                      <step.icon className="size-4" />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-widest text-muted">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted">{step.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Charity spotlight */}
      <section className="border-t border-line/60 px-5 py-20 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <div className="flex items-center gap-2 text-gold">
              <HeartHandshake className="size-4" />
              <span className="text-xs font-medium uppercase tracking-widest">
                This month's spotlight
              </span>
            </div>
          </Reveal>

          {featuredLoading ? (
            <Skeleton className="mt-8 h-56 w-full" />
          ) : featured ? (
            <Reveal delay={0.05}>
              <Card className="mt-6 grid gap-8 p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
                <div>
                  <h2 className="text-display text-3xl text-ink">{featured.name}</h2>
                  <p className="mt-4 text-muted">{featured.short_blurb}</p>
                  <p className="mt-4 max-w-2xl text-sm text-muted">{featured.description}</p>
                  <Button asChild variant="secondary" className="mt-6">
                    <Link to={`/charities/${featured.slug}`}>
                      About this charity
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
                <div className="rounded-card border border-line bg-white/[0.03] p-6">
                  <p className="text-sm text-muted">
                    Every subscriber picks their own cause. You can switch at any time, and raise your
                    contribution above the {CHARITY_PERCENTAGE_MIN}% minimum.
                  </p>
                  <Button asChild variant="ghost" className="mt-4 px-0">
                    <Link to="/charities">
                      Browse all charities
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </Card>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------- Prizes */}
      <section id="prizes" className="scroll-mt-24 border-t border-line/60 px-5 py-20 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="text-display text-3xl text-ink sm:text-4xl">How the pool is split</h2>
            <p className="mt-4 max-w-2xl text-muted">
              The pool is calculated from active subscribers each month, then divided between the
              three winning tiers. Winners in the same tier share it equally.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[...PRIZE_TIERS].reverse().map((tier, index) => (
              <Reveal key={tier} delay={index * 0.08}>
                <Card className={tier === '5_match' ? 'h-full border-gold/30 p-6' : 'h-full p-6'}>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className={tier === '5_match' ? 'text-gold' : undefined}>
                      {TIER_LABELS[tier]}
                    </CardTitle>
                    {tier === '5_match' ? <Badge tone="gold">Jackpot</Badge> : null}
                  </div>
                  <p className="mt-5 text-4xl font-semibold tabular-nums text-ink">
                    {Math.round(TIER_SPLITS[tier] * 100)}%
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {tier === '5_match'
                      ? 'Rolls over to next month if nobody matches all five.'
                      : 'Shared equally between everyone in this tier.'}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Closing CTA */}
      <section className="border-t border-line/60 px-5 py-24 lg:px-8">
        <Reveal>
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <CalendarDays className="size-6 text-accent" />
            <h2 className="mt-5 text-display text-3xl text-ink sm:text-4xl">
              The next draw is already filling up
            </h2>
            <p className="mt-4 max-w-xl text-muted">
              Subscribe today, log five rounds, and you are in this month's draw. Choose the cause
              your money supports on the way in.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  Create your account
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/charities">See the charities</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
