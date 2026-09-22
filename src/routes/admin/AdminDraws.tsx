import { CalendarPlus, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/stat'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DRAW_TYPE_LABELS } from '@/lib/constants'
import { describeDbError } from '@/lib/errors'
import { useCreateDraw, useDraws } from '@/lib/hooks/useDraws'
import { formatCents, formatDate } from '@/lib/utils'

const STATUS_TONES = {
  draft: 'gold',
  simulated: 'accent',
  published: 'neutral',
} as const

export function AdminDraws() {
  const { data: draws, isLoading, isError, error } = useDraws()
  const createDraw = useCreateDraw()

  const now = new Date()
  const [month, setMonth] = useState(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10),
  )

  async function handleCreate() {
    // The database coerces to the first of the month regardless of the day sent.
    await createDraw.mutateAsync(month).catch(() => {})
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">Draws</h1>
        <p className="max-w-2xl text-sm text-muted">
          Create a month's draw, choose how the numbers are generated, simulate the outcome, then
          publish it when you are satisfied.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Schedule a draw</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="sm:w-56">
              <Field
                label="Draw month"
                htmlFor="draw-month"
                hint="Any date in the month; the draw is filed under its first day."
              >
                <Input
                  id="draw-month"
                  type="date"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </Field>
            </div>
            <Button onClick={handleCreate} disabled={createDraw.isPending}>
              {createDraw.isPending ? <Spinner /> : <CalendarPlus />}
              Create draft
            </Button>
          </div>

          {createDraw.isError ? (
            <Alert tone="danger" title="Could not create that draw">
              {describeDbError(createDraw.error)}
            </Alert>
          ) : null}
          {createDraw.isSuccess ? (
            <Alert tone="success" title="Draw ready">
              A draft now exists for that month. Open it to configure and simulate.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All draws</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-danger">
              {error instanceof Error ? error.message : 'Could not load draws.'}
            </p>
          ) : (draws ?? []).length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No draws yet"
              description="Schedule one above to get started."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Winning numbers</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(draws ?? []).map((draw) => (
                  <TableRow key={draw.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(draw.draw_month)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[draw.status]}>{draw.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {DRAW_TYPE_LABELS[draw.draw_type]}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {draw.winning_numbers?.length
                        ? draw.winning_numbers.join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{draw.subscriber_count}</TableCell>
                    <TableCell className="tabular-nums">
                      {draw.total_pool_cents ? formatCents(draw.total_pool_cents) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button asChild size="sm" variant="secondary">
                          <Link to={`/admin/draws/${draw.id}`}>
                            {draw.status === 'published' ? 'View' : 'Open'}
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
