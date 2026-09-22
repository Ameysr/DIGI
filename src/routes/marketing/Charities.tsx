import { ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '@/components/motion/Reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/stat'
import { CHARITY_PERCENTAGE_MIN } from '@/lib/constants'
import { useCharities } from '@/lib/hooks/useCharities'

export function Charities() {
  const [search, setSearch] = useState('')
  const { data: charities, isLoading, isError, error } = useCharities(search)

  return (
    <div className="px-5 py-16 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <h1 className="text-display text-4xl text-ink">Charities</h1>
          <p className="mt-4 max-w-2xl text-muted">
            Every subscriber directs at least {CHARITY_PERCENTAGE_MIN}% of their fee to a cause of
            their choosing. You can change it whenever you like.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="relative mt-9 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or cause"
              aria-label="Search charities"
              className="pl-9"
            />
          </div>
        </Reveal>

        {isLoading ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-52" />
            ))}
          </div>
        ) : isError ? (
          <p className="mt-10 text-sm text-danger">
            We could not load the charity directory: {error instanceof Error ? error.message : 'unknown error'}
          </p>
        ) : charities && charities.length > 0 ? (
          <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {charities.map((charity, index) => (
              <li key={charity.id}>
                <Reveal delay={Math.min(index * 0.05, 0.25)}>
                  <Card className="flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-semibold text-ink">{charity.name}</h2>
                      {charity.is_featured ? <Badge tone="gold">Spotlight</Badge> : null}
                    </div>
                    <p className="mt-3 flex-1 text-sm text-muted">{charity.short_blurb}</p>
                    <Button asChild variant="ghost" className="mt-5 justify-start px-0">
                      <Link to={`/charities/${charity.slug}`}>
                        Read more
                        <ArrowRight />
                      </Link>
                    </Button>
                  </Card>
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10">
            <EmptyState
              icon={Search}
              title={search ? 'No charities match that search' : 'No charities listed yet'}
              description={
                search
                  ? 'Try a different cause, or clear the search to see everything.'
                  : 'An administrator needs to add charities before they appear here.'
              }
              action={
                search ? (
                  <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                ) : null
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
