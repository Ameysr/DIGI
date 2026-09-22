import { BadgeCheck, Check, ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/stat'
import { PaymentBadge, ReviewBadge, TierBadge } from '@/components/ui/status-badges'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { describeDbError } from '@/lib/errors'
import { useProfile } from '@/lib/hooks/useProfile'
import {
  createProofUrl,
  useAllWinners,
  useMarkPaid,
  useReviewWinner,
} from '@/lib/hooks/useWinners'
import type { ReviewStatus, WinnerWithProfile } from '@/lib/types'
import { formatCents, formatDate } from '@/lib/utils'

type ReviewFilter = 'all' | ReviewStatus

export function AdminWinners() {
  const { profile } = useProfile()
  const { data: winners, isLoading, isError, error } = useAllWinners()
  const review = useReviewWinner()
  const markPaid = useMarkPaid()

  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [rejecting, setRejecting] = useState<WinnerWithProfile | null>(null)
  const [reason, setReason] = useState('')
  const [proofError, setProofError] = useState<string | null>(null)

  const filtered = (winners ?? []).filter(
    (claim) => filter === 'all' || claim.review_status === filter,
  )

  const pendingCount = (winners ?? []).filter((claim) => claim.review_status === 'pending').length
  const unpaidCount = (winners ?? []).filter((claim) => claim.payment_status === 'pending').length

  async function viewProof(path: string) {
    setProofError(null)
    const url = await createProofUrl(path)
    if (!url) {
      setProofError('Could not generate a link for that proof file.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function approve(claim: WinnerWithProfile) {
    await review
      .mutateAsync({
        winnerId: claim.id,
        reviewStatus: 'approved',
        reviewedBy: profile?.id ?? '',
      })
      .catch(() => {})
  }

  async function confirmReject() {
    if (!rejecting) return
    try {
      await review.mutateAsync({
        winnerId: rejecting.id,
        reviewStatus: 'rejected',
        reviewedBy: profile?.id ?? '',
        rejectionReason: reason.trim() || 'Proof did not match the submitted scores.',
      })
      setRejecting(null)
      setReason('')
    } catch {
      // Rendered from review.error.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">Winners</h1>
        <p className="max-w-2xl text-sm text-muted">
          Verify proof of scores, then mark the payout as completed. Winners cannot change their own
          review or payment state — the database blocks it.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Awaiting review</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-gold">{pendingCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Awaiting payment</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-ink">{unpaidCount}</p>
        </Card>
      </div>

      {review.isError ? (
        <Alert tone="danger" title="Could not update that claim">
          {describeDbError(review.error)}
        </Alert>
      ) : null}
      {markPaid.isError ? (
        <Alert tone="danger" title="Could not mark that claim paid">
          {describeDbError(markPaid.error)}
        </Alert>
      ) : null}
      {proofError ? (
        <Alert tone="danger" title="Proof unavailable">
          {proofError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{filtered.length} claims</CardTitle>
            <div className="w-48">
              <Select
                value={filter}
                onValueChange={(value) => setFilter(value as ReviewFilter)}
                options={[
                  { value: 'all', label: 'All claims' },
                  { value: 'pending', label: 'Pending review' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                className="h-9 text-xs"
              />
            </div>
          </div>
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
              {error instanceof Error ? error.message : 'Could not load winners.'}
            </p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              title="No claims here"
              description="Nothing matches this filter yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Draw</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Prize</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">
                          {claim.profiles?.full_name ?? 'Unnamed'}
                        </span>
                        <span className="text-xs text-muted">{claim.profiles?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(claim.draws.draw_month)}
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={claim.prize_tier} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCents(claim.prize_cents)}
                    </TableCell>
                    <TableCell>
                      {claim.proof_path ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-0"
                          onClick={() => viewProof(claim.proof_path as string)}
                        >
                          View
                          <ExternalLink />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">Not uploaded</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ReviewBadge status={claim.review_status} />
                    </TableCell>
                    <TableCell>
                      <PaymentBadge status={claim.payment_status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {claim.review_status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => approve(claim)}
                              disabled={review.isPending}
                            >
                              <Check />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejecting(claim)
                                setReason('')
                              }}
                            >
                              <X />
                              Reject
                            </Button>
                          </>
                        ) : null}

                        {claim.review_status === 'approved' &&
                        claim.payment_status === 'pending' ? (
                          <Button
                            size="sm"
                            onClick={() => markPaid.mutate(claim.id)}
                            disabled={markPaid.isPending}
                          >
                            <BadgeCheck />
                            Mark paid
                          </Button>
                        ) : null}

                        {claim.payment_status === 'paid' ? (
                          <span className="text-xs text-muted">
                            {claim.paid_at ? formatDate(claim.paid_at) : 'Settled'}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent
          title="Reject this claim?"
          description="The winner sees this reason on their winnings page and can upload new proof."
        >
          <div className="flex flex-col gap-4">
            <Field label="Reason" htmlFor="rejection-reason">
              <Input
                id="rejection-reason"
                value={reason}
                placeholder="Proof did not match the submitted scores"
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmReject} disabled={review.isPending}>
                {review.isPending ? <Spinner /> : null}
                Reject claim
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
