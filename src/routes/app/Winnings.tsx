import { BadgeCheck, ImageUp, Target } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/stat'
import { PaymentBadge, ReviewBadge, TierBadge } from '@/components/ui/status-badges'
import { describeDbError } from '@/lib/errors'
import { useProfile } from '@/lib/hooks/useProfile'
import { useMyWinnings, useUploadProof } from '@/lib/hooks/useWinners'
import { formatCents, formatDate } from '@/lib/utils'

const MAX_PROOF_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function Winnings() {
  const { profile } = useProfile()
  const { data: winnings, isLoading, isError, error } = useMyWinnings(profile?.id)
  const upload = useUploadProof()
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [localError, setLocalError] = useState<string | null>(null)

  const totalWon = (winnings ?? []).reduce((total, claim) => total + claim.prize_cents, 0)
  const outstanding = (winnings ?? [])
    .filter((claim) => claim.payment_status === 'pending')
    .reduce((total, claim) => total + claim.prize_cents, 0)

  async function handleFile(winnerId: string, drawId: string, file: File | undefined) {
    setLocalError(null)
    if (!file || !profile?.id) return

    // Checked here for a fast message; the bucket enforces the same limits.
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError('Proof must be a PNG, JPEG or WebP image.')
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setLocalError('Proof must be smaller than 5 MB.')
      return
    }

    try {
      await upload.mutateAsync({ userId: profile.id, drawId, file })
    } catch {
      // Rendered from upload.error.
    } finally {
      const input = fileInputs.current[winnerId]
      if (input) input.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">Winnings</h1>
        <p className="max-w-2xl text-sm text-muted">
          Upload proof of your scores when you win. An administrator reviews it, then marks the
          payment as completed.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Total won</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-gold">
            {isLoading ? '—' : formatCents(totalWon)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Awaiting payment</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-ink">
            {isLoading ? '—' : formatCents(outstanding)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Claims</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-ink">
            {isLoading ? '—' : (winnings ?? []).length}
          </p>
        </Card>
      </div>

      {localError ? (
        <Alert tone="danger" title="That file cannot be used">
          {localError}
        </Alert>
      ) : null}

      {upload.isError ? (
        <Alert tone="danger" title="Upload failed">
          {describeDbError(upload.error)}
        </Alert>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <Alert tone="danger" title="Could not load your winnings">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      ) : (winnings ?? []).length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No winnings yet"
          description="When you match three or more numbers in a draw, your claim appears here with its payment status."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/scores">
                <Target />
                Check your scores
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {(winnings ?? []).map((claim) => {
            const isUploading = upload.isPending && upload.variables?.drawId === claim.draw_id
            return (
              <li key={claim.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle>{formatCents(claim.prize_cents)}</CardTitle>
                        <TierBadge tier={claim.prize_tier} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ReviewBadge status={claim.review_status} />
                        <PaymentBadge status={claim.payment_status} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                      <span className="text-muted">
                        Draw: <span className="text-ink">{formatDate(claim.created_at)}</span>
                      </span>
                      {claim.draws?.winning_numbers ? (
                        <span className="text-muted">
                          Winning numbers:{' '}
                          <span className="text-ink tabular-nums">
                            {claim.draws.winning_numbers.join(', ')}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    {claim.review_status === 'rejected' && claim.rejection_reason ? (
                      <Alert tone="danger" title="Proof rejected">
                        {claim.rejection_reason}
                      </Alert>
                    ) : null}

                    {claim.payment_status === 'paid' && claim.paid_at ? (
                      <Alert tone="success" title="Paid">
                        Payment completed on {formatDate(claim.paid_at)}.
                      </Alert>
                    ) : null}

                    {claim.review_status !== 'rejected' ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={(element) => {
                            fileInputs.current[claim.id] = element
                          }}
                          type="file"
                          accept={ALLOWED_TYPES.join(',')}
                          className="hidden"
                          onChange={(event) =>
                            handleFile(claim.id, claim.draw_id, event.target.files?.[0])
                          }
                        />
                        <Button
                          variant={claim.proof_path ? 'secondary' : 'primary'}
                          size="sm"
                          disabled={isUploading}
                          onClick={() => fileInputs.current[claim.id]?.click()}
                        >
                          {isUploading ? <Spinner /> : <ImageUp />}
                          {claim.proof_path ? 'Replace proof' : 'Upload proof'}
                        </Button>
                        <span className="text-xs text-muted">
                          {claim.proof_path
                            ? 'Proof submitted. You can replace it while the claim is under review.'
                            : 'Upload a screenshot of your scores. PNG, JPEG or WebP, up to 5 MB.'}
                        </span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-muted">
        Prizes are held until proof is verified.{' '}
        <Badge tone="muted">Pending → Paid</Badge>
      </p>
    </div>
  )
}
