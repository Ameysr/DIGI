import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/stat'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NumberBallRow } from '@/components/draw/NumberBall'
import { SCORE_LIMIT, SCORE_MAX, SCORE_MIN } from '@/lib/constants'
import { describeDbError } from '@/lib/errors'
import {
  useAddScore,
  useDeleteScore,
  useScores,
  useUpdateScore,
} from '@/lib/hooks/useScores'
import type { Score } from '@/lib/types'
import { formatDate, todayIsoDate } from '@/lib/utils'

/**
 * Validation mirrors the database exactly: range 1–45, no future dates, one
 * entry per date. The DB still enforces all three — this only produces better
 * messages than a constraint violation would.
 */
const scoreSchema = z.object({
  value: z
    .string()
    .min(1, 'Enter your score')
    .refine((input) => /^\d+$/.test(input), 'Use a whole number')
    .refine(
      (input) => Number(input) >= SCORE_MIN && Number(input) <= SCORE_MAX,
      `Score must be between ${SCORE_MIN} and ${SCORE_MAX}`,
    ),
  playedOn: z
    .string()
    .min(1, 'Pick the date you played')
    .refine((input) => input <= todayIsoDate(), 'A score cannot be dated in the future'),
})

type ScoreFormValues = z.infer<typeof scoreSchema>

export function Scores() {
  const today = todayIsoDate()
  const { data: scores, isLoading, isError, error } = useScores()
  const addScore = useAddScore()
  const updateScore = useUpdateScore()
  const deleteScore = useDeleteScore()

  const [editing, setEditing] = useState<Score | null>(null)
  const [deleting, setDeleting] = useState<Score | null>(null)

  const form = useForm<ScoreFormValues>({
    resolver: zodResolver(scoreSchema),
    defaultValues: { value: '', playedOn: today },
  })

  const editForm = useForm<ScoreFormValues>({
    resolver: zodResolver(scoreSchema),
    defaultValues: { value: '', playedOn: today },
  })

  const count = scores?.length ?? 0
  const remaining = Math.max(0, SCORE_LIMIT - count)
  const playedNumbers = [...(scores ?? [])]
    .sort((a, b) => a.played_on.localeCompare(b.played_on))
    .map((score) => score.value)

  async function handleAdd(values: ScoreFormValues) {
    try {
      await addScore.mutateAsync({ value: Number(values.value), playedOn: values.playedOn })
      form.reset({ value: '', playedOn: today })
    } catch {
      // Rendered from addScore.error below.
    }
  }

  function openEdit(score: Score) {
    setEditing(score)
    editForm.reset({ value: String(score.value), playedOn: score.played_on })
  }

  async function handleEdit(values: ScoreFormValues) {
    if (!editing) return
    try {
      await updateScore.mutateAsync({
        id: editing.id,
        value: Number(values.value),
        playedOn: values.playedOn,
      })
      setEditing(null)
    } catch {
      // Rendered from updateScore.error inside the dialog.
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteScore.mutateAsync(deleting.id)
      setDeleting(null)
    } catch {
      // Rendered from deleteScore.error below.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">My scores</h1>
        <p className="max-w-2xl text-sm text-muted">
          Enter each round in Stableford format. We keep your latest {SCORE_LIMIT} rounds — adding a{' '}
          {SCORE_LIMIT + 1}th removes the oldest automatically, and those five become the numbers you
          play in the monthly draw.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Draw eligibility</CardTitle>
            {count >= SCORE_LIMIT ? (
              <Badge tone="accent">Entered in the next draw</Badge>
            ) : (
              <Badge tone="gold">
                {remaining} more {remaining === 1 ? 'score' : 'scores'} needed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Progress value={(Math.min(count, SCORE_LIMIT) / SCORE_LIMIT) * 100} />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted">
              <span className="font-medium text-ink tabular-nums">{count}</span> of {SCORE_LIMIT}{' '}
              scores stored
            </p>
            {playedNumbers.length > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-muted">Your numbers</span>
                <NumberBallRow values={playedNumbers} tone="accent" size="sm" />
              </div>
            ) : null}
          </div>
          {count < SCORE_LIMIT ? (
            <p className="text-xs text-muted">
              A full set of {SCORE_LIMIT} scores is required before you can be entered into a draw.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a score</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(handleAdd)}
            className="flex flex-col gap-4 sm:flex-row sm:items-start"
          >
            <div className="sm:w-40">
              <Field
                label="Stableford score"
                htmlFor="score-value"
                error={form.formState.errors.value?.message}
              >
                <Input
                  id="score-value"
                  inputMode="numeric"
                  placeholder={`${SCORE_MIN}–${SCORE_MAX}`}
                  {...form.register('value')}
                />
              </Field>
            </div>

            <div className="sm:w-52">
              <Field
                label="Date played"
                htmlFor="score-date"
                error={form.formState.errors.playedOn?.message}
              >
                <Input
                  id="score-date"
                  type="date"
                  max={today}
                  {...form.register('playedOn')}
                />
              </Field>
            </div>

            <div className="sm:pt-7">
              <Button type="submit" disabled={addScore.isPending}>
                {addScore.isPending ? <Spinner /> : <Plus />}
                Add score
              </Button>
            </div>
          </form>

          {addScore.isError ? (
            <Alert tone="danger" className="mt-4" title="Could not save that score">
              {describeDbError(addScore.error)}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <p className="text-sm text-danger">
              Could not load your scores: {error instanceof Error ? error.message : 'unknown error'}
            </p>
          ) : count === 0 ? (
            <EmptyState
              icon={Target}
              title="No scores yet"
              description={`Add your first round above. You need ${SCORE_LIMIT} to be entered into the monthly draw.`}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date played</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores?.map((score) => (
                  <TableRow key={score.id}>
                    <TableCell>{formatDate(`${score.played_on}T00:00:00`)}</TableCell>
                    <TableCell>
                      <span className="font-semibold tabular-nums">{score.value}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit score from ${score.played_on}`}
                          onClick={() => openEdit(score)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete score from ${score.played_on}`}
                          onClick={() => setDeleting(score)}
                        >
                          <Trash2 />
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

      {/* ------------------------------------------------------------- Edit */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent title="Edit score" description="Change the value or the date of this round.">
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="flex flex-col gap-4">
            <Field
              label="Stableford score"
              htmlFor="edit-score-value"
              error={editForm.formState.errors.value?.message}
            >
              <Input id="edit-score-value" inputMode="numeric" {...editForm.register('value')} />
            </Field>

            <Field
              label="Date played"
              htmlFor="edit-score-date"
              error={editForm.formState.errors.playedOn?.message}
            >
              <Input
                id="edit-score-date"
                type="date"
                max={today}
                {...editForm.register('playedOn')}
              />
            </Field>

            {updateScore.isError ? (
              <Alert tone="danger" title="Could not update that score">
                {describeDbError(updateScore.error)}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateScore.isPending}>
                {updateScore.isPending ? <Spinner /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------- Delete */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent
          title="Delete this score?"
          description="This removes the round from your history. It cannot be undone."
        >
          {deleteScore.isError ? (
            <Alert tone="danger" title="Could not delete that score">
              {describeDbError(deleteScore.error)}
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteScore.isPending}>
              {deleteScore.isPending ? <Spinner /> : null}
              Delete score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
