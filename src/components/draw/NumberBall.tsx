import { cn } from '@/lib/utils'

/** A single drawn number. Tones distinguish winning numbers from a player's. */
export function NumberBall({
  value,
  tone = 'neutral',
  matched = false,
  className,
}: {
  value: number
  tone?: 'neutral' | 'accent' | 'gold' | 'muted'
  /** Highlighted because it also appears in the player's own numbers. */
  matched?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
        tone === 'gold' && 'border-gold/40 bg-gold/15 text-gold',
        tone === 'accent' && 'border-accent/40 bg-accent/15 text-accent',
        tone === 'neutral' && 'border-line bg-white/[0.06] text-ink',
        tone === 'muted' && 'border-line bg-transparent text-muted',
        matched && 'ring-2 ring-accent/50',
        className,
      )}
    >
      {value}
    </span>
  )
}

export function NumberBallRow({
  values,
  tone,
  matchedValues,
  size = 'md',
}: {
  values: number[]
  tone?: 'neutral' | 'accent' | 'gold' | 'muted'
  matchedValues?: number[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value, index) => (
        <NumberBall
          key={`${value}-${index}`}
          value={value}
          tone={tone}
          matched={matchedValues?.includes(value)}
          className={size === 'sm' ? 'size-7 text-xs' : undefined}
        />
      ))}
    </div>
  )
}
