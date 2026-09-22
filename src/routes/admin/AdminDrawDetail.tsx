import { ArrowLeft, Dices, FlaskConical, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NumberBallRow } from '@/components/draw/NumberBall'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Stat } from '@/components/ui/stat'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TierBadge } from '@/components/ui/status-badges'
import { DRAW_TYPE_LABELS, DRAW_TYPES, TIER_LABELS, type DrawType } from '@/lib/constants'
import { simulate, type Simulation } from '@/lib/draw/engine'
import { describeDbError } from '@/lib/errors'
import {
  useActivePaymentsCents,
  useDrawEntriesForAdmin,
  useEligibleEntries,
} from '@/lib/hooks/useAdmin'
import { useDraw, useDraws, usePublishDraw, useUpdateDrawType } from '@/lib/hooks/useDraws'
import { formatCents, formatDate } from '@/lib/utils'

export function AdminDrawDetail() {
  const { drawId } = useParams<{ drawId: string }>()
  const { data: draw, isLoading } = useDraw(drawId)
  const { data: allDraws } = useDraws()
  const { data: eligible, isLoading: eligibleLoading } = useEligibleEntries()
  const { data: paymentsCents, isLoading: paymentsLoading } = useActivePaymentsCents()
  const { data: entries, isLoading: entriesLoading } = useDrawEntriesForAdmin(drawId)

  const updateType = useUpdateDrawType()
  const publish = usePublishDraw()

  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  /**
   * The jackpot carried in: the rollover from the most recent published draw
   * before this one. publish_draw applies the same rule, so the previewed pool
   * matches what will actually be committed.
   */
  const rolloverInCents = useMemo(() => {
    if (!draw || !allDraws) return 0
    const previous = allDraws
      .filter((item) => item.status === 'published' && item.draw_month < draw.draw_month)
      .sort((a, b) => b.draw_month.localeCompare(a.draw_month))[0]
    return previous?.rollover_out_cents ?? 0
  }, [draw, allDraws])

  const totalPaymentsCents = paymentsCents ?? 0

  function runSimulation() {
    if (!draw || !eligible) return
    setSimulation(
      simulate({
        entries: eligible.map((player) => ({ userId: player.userId, numbers: player.numbers })),
        drawType: draw.draw_type,
        totalPaymentsCents,
        rolloverInCents,
      }),
    )
  }

  async function handlePublish() {
    if (!drawId || !simulation) return
    try {
      await publish.mutateAsync({ drawId, numbers: simulation.numbers })
      setConfirmOpen(false)
    } catch {
      // Rendered from publish.error.
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!draw) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-display text-2xl text-ink">Draw not found</h1>
        <Button asChild variant="secondary">
          <Link to="/admin/draws">
            <ArrowLeft />
            Back to draws
          </Link>
        </Button>
      </div>
    )
  }

  const isPublished = draw.status === 'published'
  const loadingInputs = eligibleLoading || paymentsLoading

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          to="/admin/draws"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          All draws
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-display text-3xl text-ink">{formatDate(draw.draw_month)}</h1>
            <p className="text-sm text-muted">
              {DRAW_TYPE_LABELS[draw.draw_type]} draw
              {draw.published_at ? ` · published ${formatDate(draw.published_at)}` : ''}
            </p>
          </div>
          <Badge tone={isPublished ? 'neutral' : 'gold'}>{draw.status}</Badge>
        </div>
      </div>

      {publish.isError ? (
        <Alert tone="danger" title="Could not publish the draw">
          {describeDbError(publish.error)}
        </Alert>
      ) : null}

      {updateType.isError ? (
        <Alert tone="danger" title="Could not change the draw type">
          {describeDbError(updateType.error)}
        </Alert>
      ) : null}

      {/* ------------------------------------------------------ Configuration */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Eligible players"
          value={loadingInputs ? '—' : (eligible?.length ?? 0)}
          hint="Active subscribers with five scores"
        />
        <Stat
          label="Projected pool"
          value={loadingInputs ? '—' : formatCents(Math.round(totalPaymentsCents * 0.5) + rolloverInCents)}
          hint={`Monthly-normalised contributions + ${formatCents(rolloverInCents)} rollover`}
          tone="accent"
        />
        <Stat
          label="Rollover in"
          value={formatCents(rolloverInCents)}
          hint="Unclaimed jackpot from the last draw"
          tone="gold"
        />
        <Stat
          label="Entries recorded"
          value={entriesLoading ? '—' : (entries?.length ?? 0)}
          hint={isPublished ? 'Final field' : 'Empty until published'}
        />
      </div>

      {!isPublished ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="sm:w-80">
              <Field
                label="Draw type"
                htmlFor="draw-type"
                hint={
                  draw.draw_type === 'random'
                    ? 'Five distinct numbers drawn uniformly from 1–45.'
                    : 'Numbers weighted by how often they were scored this month.'
                }
              >
                <Select
                  id="draw-type"
                  value={draw.draw_type}
                  onValueChange={(value) =>
                    updateType.mutate({ drawId: draw.id, drawType: value as DrawType })
                  }
                  options={DRAW_TYPES.map((type) => ({
                    value: type,
                    label: DRAW_TYPE_LABELS[type],
                  }))}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runSimulation} disabled={loadingInputs} variant="secondary">
                <FlaskConical />
                Simulate draw
              </Button>
              <p className="text-xs text-muted">
                Simulation writes nothing. Run it as many times as you like — publishing uses
                exactly the numbers shown.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* --------------------------------------------------------- Simulation */}
      {simulation && !isPublished ? (
        <Card className="border-accent/25">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Simulation result</CardTitle>
              <Badge tone="accent">
                <Dices />
                Not yet published
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Winning numbers</p>
              <div className="mt-3">
                <NumberBallRow values={simulation.numbers} tone="gold" />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead>Winners</TableHead>
                  <TableHead>Tier pool</TableHead>
                  <TableHead>Each</TableHead>
                  <TableHead>Rolls over</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulation.tiers.map((tier) => (
                  <TableRow key={tier.tier}>
                    <TableCell>{TIER_LABELS[tier.tier]}</TableCell>
                    <TableCell className="tabular-nums">{tier.winnerCount}</TableCell>
                    <TableCell className="tabular-nums">{formatCents(tier.poolCents)}</TableCell>
                    <TableCell className="tabular-nums">
                      {tier.perWinnerCents ? formatCents(tier.perWinnerCents) : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {tier.rolloverCents ? formatCents(tier.rolloverCents) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-sm text-muted">
                Total pool {formatCents(simulation.poolCents)} · jackpot rolls over{' '}
                {formatCents(simulation.rolloverOutCents)}
              </p>
              <Button onClick={() => setConfirmOpen(true)}>
                <Send />
                Publish draw
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- Final result */}
      {isPublished ? (
        <Card>
          <CardHeader>
            <CardTitle>Published result</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Winning numbers</p>
              <div className="mt-3">
                <NumberBallRow values={draw.winning_numbers ?? []} tone="gold" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Pool" value={formatCents(draw.total_pool_cents)} />
              <Stat label="Entries" value={draw.subscriber_count} />
              <Stat
                label="Rolled over"
                value={draw.rollover_out_cents ? formatCents(draw.rollover_out_cents) : '—'}
                tone="gold"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ Entries */}
      {isPublished ? (
        <Card>
          <CardHeader>
            <CardTitle>Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {entriesLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (entries ?? []).length === 0 ? (
              <p className="text-sm text-muted">No entries were recorded for this draw.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Numbers</TableHead>
                    <TableHead>Matched</TableHead>
                    <TableHead>Prize</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entries ?? []).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.profiles?.full_name ?? entry.profiles?.email ?? entry.user_id}
                      </TableCell>
                      <TableCell>
                        <NumberBallRow
                          values={entry.numbers}
                          tone="accent"
                          size="sm"
                          matchedValues={draw.winning_numbers ?? []}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">{entry.matched_count}</TableCell>
                      <TableCell>
                        {entry.prize_tier ? (
                          <div className="flex flex-col gap-1">
                            <TierBadge tier={entry.prize_tier} />
                            <span className="text-xs text-muted">
                              {formatCents(entry.prize_cents)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------- Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Publish this draw?"
          description="This commits the winning numbers, writes every entry, calculates prizes and creates winner claims. It cannot be undone."
        >
          {simulation ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Winning numbers</p>
                <div className="mt-2">
                  <NumberBallRow values={simulation.numbers} tone="gold" size="sm" />
                </div>
              </div>
              <p className="text-sm text-muted">
                {simulation.entries.filter((entry) => entry.tier).length} winning claim
                {simulation.entries.filter((entry) => entry.tier).length === 1 ? '' : 's'} will be
                created from {simulation.entries.length} entries.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publish.isPending}>
              {publish.isPending ? <Spinner /> : <Send />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
