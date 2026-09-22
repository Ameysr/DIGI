import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function Logo({ className, to = '/' }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-baseline gap-0.5 text-lg font-semibold tracking-tight',
        className,
      )}
    >
      <span className="text-ink/70">digital</span>
      <span className="text-accent">.</span>
      <span className="text-ink">HEROES</span>
      <span className="text-accent">.</span>
    </Link>
  )
}
