import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const tones = {
  info: { wrapper: 'border-line bg-white/[0.03]', icon: 'text-muted', Icon: Info },
  success: { wrapper: 'border-accent/30 bg-accent/[0.07]', icon: 'text-accent', Icon: CheckCircle2 },
  warning: { wrapper: 'border-gold/30 bg-gold/[0.07]', icon: 'text-gold', Icon: AlertTriangle },
  danger: { wrapper: 'border-danger/30 bg-danger/[0.07]', icon: 'text-danger', Icon: AlertTriangle },
} as const

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones
  title?: string
  children?: ReactNode
  className?: string
}) {
  const { wrapper, icon, Icon } = tones[tone]

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-4 text-sm', wrapper, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', icon)} />
      <div className="flex flex-col gap-1">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        {children ? <div className="text-muted">{children}</div> : null}
      </div>
    </div>
  )
}
