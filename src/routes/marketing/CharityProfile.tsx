import { ArrowLeft, CalendarDays, ExternalLink, MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DonateForm } from '@/components/charity/DonateForm'
import { Reveal } from '@/components/motion/Reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CHARITY_PERCENTAGE_MIN } from '@/lib/constants'
import { useCharity } from '@/lib/hooks/useCharities'
import { formatDate } from '@/lib/utils'

export function CharityProfile() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading } = useCharity(slug)

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-16 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-5 py-24 lg:px-8">
        <h1 className="text-display text-3xl text-ink">Charity not found</h1>
        <p className="text-muted">
          This charity may have been removed, or the link may be wrong.
        </p>
        <Button asChild variant="secondary">
          <Link to="/charities">
            <ArrowLeft />
            Back to all charities
          </Link>
        </Button>
      </div>
    )
  }

  const { charity, events } = data

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-16 lg:px-8">
      <Link
        to="/charities"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All charities
      </Link>

      <Reveal>
        {charity.image_url ? (
          <img
            src={charity.image_url}
            alt=""
            className="mt-6 h-56 w-full rounded-card border border-line object-cover sm:h-72"
          />
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <h1 className="text-display text-4xl text-ink">{charity.name}</h1>
          {charity.is_featured ? <Badge tone="gold">Spotlight</Badge> : null}
        </div>
        <p className="mt-4 max-w-2xl text-lg text-muted">{charity.short_blurb}</p>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="mt-8">
          <CardContent className="p-6">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {charity.description}
            </p>
            {charity.website_url ? (
              <a
                href={charity.website_url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-5 inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                Visit their website
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted" />
              <CardTitle>Upcoming events</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted">
                No events scheduled right now. Check back soon.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {events.map((event) => (
                  <li key={event.id} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">{event.title}</p>
                      <p className="text-xs text-muted">{formatDate(event.starts_at)}</p>
                    </div>
                    <p className="text-sm text-muted">{event.description}</p>
                    {event.location ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
                        <MapPin className="size-3" />
                        {event.location}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-card border border-accent/25 bg-accent/[0.06] p-6">
          <p className="flex-1 text-sm text-ink">
            Want this to be your cause? Subscribe and at least {CHARITY_PERCENTAGE_MIN}% of your fee
            goes here every month.
          </p>
          <Button asChild>
            <Link to="/signup">Subscribe</Link>
          </Button>
        </div>
      </Reveal>

      {/* Independent of the subscription — PRD §08.1. Placed after the subscribe
          prompt so the recurring option is seen first, but reachable on its own
          for anyone who wants to give without signing up to the platform. */}
      <Reveal delay={0.2}>
        <div className="mt-6">
          <DonateForm charityId={charity.id} charityName={charity.name} />
        </div>
      </Reveal>
    </div>
  )
}
