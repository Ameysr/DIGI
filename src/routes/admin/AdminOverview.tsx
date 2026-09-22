import { BadgeCheck, Gauge, HeartHandshake, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaymentBadge, ReviewBadge } from '@/components/ui/status-badges'
import { useAdminStats } from '@/lib/hooks/useAdmin'
import { useDraws } from '@/lib/hooks/useDraws'
import { useAllWinners } from '@/lib/hooks/useWinners'
import { formatCents, formatDate } from '@/lib/utils'

export function AdminOverview() {
  const { data: stats, isLoading, isError, error } = useAdminStats()
  const { data: draws } = useDraws()
  const { data: winners } = useAllWinners()

  const published = (draws ?? []).filter((draw) => draw.status === 'published')
  const poolSeries = [...published]
    .reverse()
    .map((draw) => ({
      month: new Date(draw.draw_month).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
      pool: Math.round(draw.total_pool_cents / 100),
    }))

  const openClaims = (winners ?? []).filter(
    (claim) => claim.review_status === 'pending' || claim.payment_status === 'pending',
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">Overview</h1>
        <p className="text-sm text-muted">
          Platform health at a glance: subscribers, money in, and what still needs review.
        </p>
      </header>

      {isError ? (
        <Alert tone="danger" title="Could not load platform statistics">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28" />)
        ) : (
          <>
            <Stat
              label="Total users"
              value={stats?.totalUsers ?? 0}
              hint={`${stats?.activeSubscribers ?? 0} with an active subscription`}
              icon={Users}
            />
            <Stat
              label="Total prize pool"
              value={formatCents(stats?.totalPrizePoolCents ?? 0)}
              hint={`Across ${stats?.publishedDraws ?? 0} published draws`}
              icon={Trophy}
              tone="accent"
            />
            <Stat
              label="Charity contributions"
              value={formatCents(stats?.totalCharityCents ?? 0)}
              hint="Recorded in the contribution ledger"
              icon={HeartHandshake}
              tone="gold"
            />
            <Stat
              label="Paid out"
              value={formatCents(stats?.paidOutCents ?? 0)}
              hint="Claims marked as paid"
              icon={BadgeCheck}
            />
            <Stat
              label="Claims awaiting review"
              value={stats?.pendingClaims ?? 0}
              hint="Winner proof to verify"
              icon={Gauge}
              tone={stats?.pendingClaims ? 'gold' : 'default'}
            />
            <Stat
              label="Published draws"
              value={stats?.publishedDraws ?? 0}
              hint="Completed monthly draws"
              icon={Trophy}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prize pool by draw</CardTitle>
        </CardHeader>
        <CardContent>
          {poolSeries.length === 0 ? (
            <p className="text-sm text-muted">
              No published draws yet. Run one from the Draws section to see it here.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={poolSeries}>
                  <CartesianGrid stroke="#1b2630" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#8fa49c"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#8fa49c"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) => `$${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: '#0b1014',
                      border: '1px solid #1b2630',
                      borderRadius: 8,
                      color: '#e7f5ee',
                    }}
                    formatter={(value) => [`$${Number(value)}`, 'Prize pool']}
                  />
                  <Bar dataKey="pool" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Claims needing attention</CardTitle>
            <Button asChild variant="ghost" size="sm" className="px-0">
              <Link to="/admin/winners">All winners</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {openClaims.length === 0 ? (
            <p className="text-sm text-muted">Nothing outstanding. Every claim is settled.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Prize</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openClaims.slice(0, 6).map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>{claim.profiles?.full_name ?? claim.profiles?.email ?? claim.user_id}</TableCell>
                    <TableCell className="tabular-nums">{formatCents(claim.prize_cents)}</TableCell>
                    <TableCell>
                      <ReviewBadge status={claim.review_status} />
                    </TableCell>
                    <TableCell>
                      <PaymentBadge status={claim.payment_status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {published.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent draws</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Winning numbers</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Rollover</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {published.slice(0, 5).map((draw) => (
                  <TableRow key={draw.id}>
                    <TableCell>{formatDate(draw.draw_month)}</TableCell>
                    <TableCell className="tabular-nums">
                      {(draw.winning_numbers ?? []).join(', ')}
                    </TableCell>
                    <TableCell className="tabular-nums">{draw.subscriber_count}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCents(draw.total_pool_cents)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {draw.rollover_out_cents > 0 ? formatCents(draw.rollover_out_cents) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
