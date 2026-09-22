import { CalendarClock, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NumberBallRow } from '@/components/draw/NumberBall'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/stat'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TierBadge } from '@/components/ui/status-badges'
import { useDraws, useMyEntries } from '@/lib/hooks/useDraws'
import { useProfile } from '@/lib/hooks/useProfile'
import { useScores } from '@/lib/hooks/useScores'
import { SCORE_LIMIT } from '@/lib/constants'
import { formatCents, formatDate } from '@/lib/utils'

export function Draws() {
  const { profile } = useProfile()
  const { data: entries, isLoading } = useMyEntries(profile?.id)
  const { data: draws } = useDraws()
  const { data: scores } = useScores()

  const scoreCount = scores?.length ?? 0
  const publishedDraws = (draws ?? []).filter((draw) => draw.status === 'published')
  const nextDraw = draws?.find((draw) => draw.status === 'draft')

  const entryByDrawId = new Map((entries ?? []).map((entry) => [entry.draw_id, entry]))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">Draws</h1>
        <p className="max-w-2xl text-sm text-muted">
          Every published draw you were part of, with your numbers and how many matched.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Next draw</CardTitle>
            {scoreCount >= SCORE_LIMIT ? (
              <Badge tone="accent">You are eligible</Badge>
            ) : (
              <Badge tone="gold">
                {SCORE_LIMIT - scoreCount} more {SCORE_LIMIT - scoreCount === 1 ? 'score' : 'scores'} needed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <CalendarClock className="size-4" />
            {nextDraw
              ? `Scheduled for ${formatDate(nextDraw.draw_month)} — winners are published once the draw runs.`
              : 'The next draw will be scheduled by the platform administrators.'}
          </div>

          {scoreCount >= SCORE_LIMIT ? (
            <p className="text-sm text-muted">
              You will be entered automatically using your latest {SCORE_LIMIT} scores.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted">
                Add {SCORE_LIMIT - scoreCount} more round
                {SCORE_LIMIT - scoreCount === 1 ? '' : 's'} to be entered.
              </p>
              <Button asChild size="sm" variant="secondary">
                <Link to="/scores">Add scores</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your draw history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : publishedDraws.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No draws published yet"
              description="Once a draw is published, your entry and result will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Draw</TableHead>
                  <TableHead>Winning numbers</TableHead>
                  <TableHead>Your numbers</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publishedDraws.map((draw) => {
                  const entry = entryByDrawId.get(draw.id)
                  return (
                    <TableRow key={draw.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(draw.draw_month)}
                      </TableCell>
                      <TableCell>
                        <NumberBallRow values={draw.winning_numbers ?? []} tone="gold" size="sm" />
                      </TableCell>
                      <TableCell>
                        {entry ? (
                          <NumberBallRow
                            values={entry.numbers}
                            tone="accent"
                            size="sm"
                            matchedValues={draw.winning_numbers ?? []}
                          />
                        ) : (
                          <span className="text-xs text-muted">
                            Not entered
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry?.prize_tier ? (
                          <div className="flex flex-col gap-1">
                            <TierBadge tier={entry.prize_tier} />
                            <span className="text-xs text-muted">
                              {formatCents(entry.prize_cents)}
                            </span>
                          </div>
                        ) : entry ? (
                          <span className="text-xs text-muted">
                            {entry.matched_count} matched
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
