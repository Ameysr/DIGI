import { useAuth } from '@/lib/auth/context'
import { HeartHandshake } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  DONATION_MAX_CENTS,
  DONATION_MIN_CENTS,
  DONATION_PRESETS_CENTS,
} from '@/lib/constants'
import { useDonate } from '@/lib/hooks/useDonations'
import { cn, formatCents } from '@/lib/utils'

/**
 * One-off donation to a charity — PRD §08.1, "independent donation option, not
 * tied to gameplay".
 *
 * Deliberately separate from the subscription controls: this money goes to the
 * charity and nothing else. It does not buy draw entries and does not touch the
 * prize pool, which is why it lives on the charity rather than the plan.
 */
export function DonateForm({ charityId, charityName }: { charityId: string; charityName: string }) {
  const { isLoaded, isSignedIn } = useAuth()
  const donate = useDonate()

  const [amount, setAmount] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const enteredCents = Math.round(Number(amount) * 100)
  const amountValid =
    Number.isFinite(enteredCents) &&
    enteredCents >= DONATION_MIN_CENTS &&
    enteredCents <= DONATION_MAX_CENTS

  async function submit() {
    setLocalError(null)
    setDone(null)

    if (!amountValid) {
      setLocalError(
        `Enter an amount between ${formatCents(DONATION_MIN_CENTS)} and ${formatCents(
          DONATION_MAX_CENTS,
        )}.`,
      )
      return
    }

    try {
      await donate.mutateAsync({ charityId, amountCents: enteredCents })
      setDone(enteredCents)
      setAmount('')
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'The donation could not be processed.')
    }
  }

  return (
    <Card className="border-gold/25">
      <CardHeader>
        <div className="flex items-center gap-3">
          <HeartHandshake className="size-5 text-gold" />
          <CardTitle>Make a one-off donation</CardTitle>
        </div>
        <p className="text-sm text-muted">
          A direct gift to {charityName}. It goes to them in full and is entirely separate from your
          subscription — it buys nothing and does not affect the draw.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {isLoaded && !isSignedIn ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/login">Sign in to donate</Link>
            </Button>
            <span className="text-xs text-muted">
              Donations are recorded against your account so the charity can account for them.
            </span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <Label htmlFor={`donation-amount-${charityId}`}>Amount (₹)</Label>
              <div className="flex flex-wrap gap-2">
                {DONATION_PRESETS_CENTS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={enteredCents === preset ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setAmount(String(preset / 100))}
                  >
                    {formatCents(preset)}
                  </Button>
                ))}
              </div>
              <Input
                id={`donation-amount-${charityId}`}
                inputMode="decimal"
                placeholder="Or enter an amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                className={cn(!amountValid && amount !== '' && 'border-danger/50')}
              />
            </div>

            {localError ? (
              <Alert tone="danger" title="Donation not completed">
                {localError}
              </Alert>
            ) : null}

            {done !== null ? (
              <Alert tone="success" title="Thank you">
                Your {formatCents(done)} donation to {charityName} has been recorded. It will appear
                in your contribution history.
              </Alert>
            ) : null}

            <div className="flex items-center gap-3">
              <Button onClick={submit} disabled={donate.isPending || !isLoaded}>
                {donate.isPending ? <Spinner /> : <HeartHandshake />}
                Donate {amountValid ? formatCents(enteredCents) : ''}
              </Button>
              <span className="text-xs text-muted">
                Processed by Razorpay. Test mode — no real money moves.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
