import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Headline figure used across both dashboards. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  tone?: 'default' | 'accent' | 'gold'
  className?: string
}) {
  const valueTone =
    tone === 'accent' ? 'text-accent' : tone === 'gold' ? 'text-gold' : 'text-ink'

  return (
    <div className={cn('panel rounded-card p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {Icon ? <Icon className="size-4 text-muted" /> : null}
      </div>
      <p className={cn('mt-3 text-2xl font-semibold tracking-tight', valueTone)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

/** Shown when a list legitimately has nothing in it yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center">
      {Icon ? <Icon className="size-6 text-muted" /> : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink">{title}</p>
        {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
