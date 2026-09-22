import { ArrowRight, HeartHandshake } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  CHARITY_PERCENTAGE_DEFAULT,
  CHARITY_PERCENTAGE_MAX,
  CHARITY_PERCENTAGE_MIN,
  PRICE_MONTHLY_CENTS,
} from '@/lib/constants'
import { describeDbError } from '@/lib/errors'
import { useCharities, useUpdateMyCharity } from '@/lib/hooks/useCharities'
import { useProfile } from '@/lib/hooks/useProfile'
import type { Profile } from '@/lib/types'
import { formatCents } from '@/lib/utils'

/**
 * Post-signup step: choose the cause, and how much of the fee it receives.
 *
 * The minimum is enforced by a CHECK constraint on profiles, so the slider
 * cannot go below it even if a client is tampered with.
 */
export function Onboarding() {
  const { profile, isLoading } = useProfile()

  return (
    <div className="aurora flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <HeartHandshake className="size-5 text-gold" />
            <CardTitle className="text-xl">Choose your charity</CardTitle>
          </div>
          <p className="text-sm text-muted">
            This is the cause your subscription supports every month. You can change it at any time.
          </p>
        </CardHeader>

        <CardContent>
          {isLoading || !profile ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <OnboardingForm profile={profile} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OnboardingForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const { data: charities, isLoading: charitiesLoading } = useCharities()
  const updateCharity = useUpdateMyCharity()

  // Seeded from the profile at mount; the parent renders this only once the
  // profile has loaded, so no effect is needed to sync it in.
  const [charityId, setCharityId] = useState(profile.charity_id ?? '')
  const [percentage, setPercentage] = useState(
    Number(profile.charity_percentage ?? CHARITY_PERCENTAGE_DEFAULT),
  )

  const monthlyShare = Math.round((PRICE_MONTHLY_CENTS * percentage) / 100)

  async function handleSubmit() {
    if (!charityId) return
    try {
      await updateCharity.mutateAsync({
        userId: profile.id,
        charityId,
        charityPercentage: percentage,
      })
      navigate('/subscription')
    } catch {
      // Rendered from updateCharity.error below.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {charitiesLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Field label="Charity" htmlFor="charity">
          <Select
            id="charity"
            value={charityId || undefined}
            onValueChange={setCharityId}
            placeholder="Select a charity"
            options={(charities ?? []).map((charity) => ({
              value: charity.id,
              label: charity.name,
            }))}
          />
        </Field>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="percentage">Contribution</Label>
          <span className="text-sm font-medium text-accent tabular-nums">{percentage}%</span>
        </div>

        <input
          id="percentage"
          type="range"
          min={CHARITY_PERCENTAGE_MIN}
          max={CHARITY_PERCENTAGE_MAX}
          step={1}
          value={percentage}
          onChange={(event) => setPercentage(Number(event.target.value))}
          className="w-full accent-[#34d399]"
        />

        <Progress
          value={
            ((percentage - CHARITY_PERCENTAGE_MIN) /
              (CHARITY_PERCENTAGE_MAX - CHARITY_PERCENTAGE_MIN)) *
            100
          }
        />

        <p className="text-xs text-muted">
          {formatCents(monthlyShare)} of your {formatCents(PRICE_MONTHLY_CENTS)} monthly fee — that
          is {percentage}%. The minimum is {CHARITY_PERCENTAGE_MIN}%, and the prize pool is
          unaffected by this choice.
        </p>
      </div>

      {updateCharity.isError ? (
        <Alert tone="danger" title="Could not save your charity">
          {describeDbError(updateCharity.error)}
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          Skip for now
        </Button>
        <Button onClick={handleSubmit} disabled={!charityId || updateCharity.isPending}>
          {updateCharity.isPending ? <Spinner /> : null}
          Continue to plans
          <ArrowRight />
        </Button>
      </div>
    </div>
  )
}
