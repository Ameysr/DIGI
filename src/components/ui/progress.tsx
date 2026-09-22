import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number
  className?: string
  indicatorClassName?: string
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full bg-accent transition-transform', indicatorClassName)}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}
