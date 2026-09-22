import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-white/[0.05] text-ink/80',
        accent: 'border-accent/30 bg-accent/12 text-accent',
        gold: 'border-gold/30 bg-gold/12 text-gold',
        danger: 'border-danger/30 bg-danger/12 text-danger',
        muted: 'border-line bg-transparent text-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
