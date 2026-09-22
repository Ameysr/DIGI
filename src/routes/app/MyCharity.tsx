import { HeartHandshake } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  CHARITY_PERCENTAGE_DEFAULT,
  CHARITY_PERCENTAGE_MAX,
  CHARITY_PERCENTAGE_MIN,
  PRIZE_POOL_RATE,
  PRICE_MONTHLY_CENTS,
} from '@/lib/constants'
import { describeDbError } from '@/lib/errors'
import { useCharities, useMyContributions, useUpdateMyCharity } from '@/lib/hooks/useCharities'
import { useProfile } from '@/lib/hooks/useProfile'
import type { Profile } from '@/lib/types'
import { formatCents, formatDate } from '@/lib/utils'

export function MyCharity() {
  const { profile, userId, isLoading } = useProfile()
  const { data: charities } = useCharities()
  const { data: contributions, isLoading: contributionsLoading } = useMyContributions(userId)

  const selected = charities?.find((charity) => charity.id === profile?.charity_id) ?? null

  const totalContributed = (contributions ?? []).reduce(
    (total, row) => total + Number((row as { amount_cents: number }).amount_cents),
    0,
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">My charity</h1>
        <p className="max-w-2xl text-sm text-muted">
          Choose where your contribution goes and how much of your fee it receives. Raising your
          share does not reduce the prize pool.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Your selection</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !profile ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              // Mounted only once the profile is available, so the form's initial
              // state is correct without an effect that syncs it afterwards.
              <CharitySelectionForm profile={profile} />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Current cause</CardTitle>
                <HeartHandshake className="size-4 text-gold" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {selected ? (
                <>
                  <p className="text-base font-medium text-ink">{selected.name}</p>
                  <p className="text-muted">{selected.short_blurb}</p>
                </>
              ) : (
                <p className="text-muted">
                  No charity selected. Your subscription still enters the draw, but nothing is being
                  directed to a cause.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total contributed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-gold">
                {contributionsLoading ? '—' : formatCents(totalContributed)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Contributions and one-off donations to date, from{' '}
                {(contributions ?? []).length} payment{(contributions ?? []).length === 1 ? '' : 's'}.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contribution history</CardTitle>
        </CardHeader>
        <CardContent>
          {contributionsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (contributions ?? []).length === 0 ? (
            <p className="text-sm text-muted">
              No contributions recorded yet. They appear after your first successful payment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contributions ?? []).map((row) => {
                  const contribution = row as {
                    id: string
                    period_month: string
                    amount_cents: number
                    source?: string
                  }
                  return (
                    <TableRow key={contribution.id}>
                      <TableCell>{formatDate(`${contribution.period_month}T00:00:00`)}</TableCell>
                      <TableCell>
                        {contribution.source === 'donation' ? (
                          <Badge tone="gold">Donation</Badge>
                        ) : (
                          <Badge tone="muted">Subscription</Badge>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCents(Number(contribution.amount_cents))}
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

function CharitySelectionForm({ profile }: { profile: Profile }) {
  const { data: charities } = useCharities()
  const update = useUpdateMyCharity()

  const savedCharityId = profile.charity_id ?? ''
  const savedPercentage = Number(profile.charity_percentage ?? CHARITY_PERCENTAGE_DEFAULT)

  const [charityId, setCharityId] = useState(savedCharityId)
  const [percentage, setPercentage] = useState(savedPercentage)

  const dirty = charityId !== savedCharityId || percentage !== savedPercentage
  const monthlyShare = Math.round((PRICE_MONTHLY_CENTS * percentage) / 100)

  async function handleSave() {
    if (!charityId) return
    await update
      .mutateAsync({ userId: profile.id, charityId, charityPercentage: percentage })
      .catch(() => {})
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Charity" htmlFor="charity-select">
        <Select
          id="charity-select"
          value={charityId || undefined}
          onValueChange={setCharityId}
          placeholder="Select a charity"
          options={(charities ?? []).map((charity) => ({
            value: charity.id,
            label: charity.name,
          }))}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="charity-percentage">Contribution</Label>
          <span className="text-sm font-medium text-accent tabular-nums">{percentage}%</span>
        </div>
        <input
          id="charity-percentage"
          type="range"
          min={CHARITY_PERCENTAGE_MIN}
          max={CHARITY_PERCENTAGE_MAX}
          step={1}
          value={percentage}
          onChange={(event) => setPercentage(Number(event.target.value))}
          className="w-full accent-[#34d399]"
        />
        <p className="text-xs text-muted">
          {formatCents(monthlyShare)} of your {formatCents(PRICE_MONTHLY_CENTS)} monthly fee. Minimum{' '}
          {CHARITY_PERCENTAGE_MIN}%, maximum {CHARITY_PERCENTAGE_MAX}%. The prize pool stays at{' '}
          {Math.round(PRIZE_POOL_RATE * 100)}% regardless.
        </p>
      </div>

      {update.isError ? (
        <Alert tone="danger" title="Could not save your changes">
          {describeDbError(update.error)}
        </Alert>
      ) : null}
      {update.isSuccess && !dirty ? (
        <Alert tone="success" title="Saved">
          Your charity contribution has been updated.
        </Alert>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty || !charityId || update.isPending}>
          {update.isPending ? <Spinner /> : null}
          Save changes
        </Button>
        {dirty ? <span className="text-xs text-muted">Unsaved changes</span> : null}
      </div>
    </div>
  )
}
