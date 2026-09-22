import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Shared chrome for the sign-in and sign-up screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="aurora flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link to="/" className="mb-2 inline-flex items-baseline gap-0.5 text-lg font-semibold">
            <span className="text-ink/70">digital</span>
            <span className="text-accent">.</span>
            <span className="text-ink">HEROES</span>
            <span className="text-accent">.</span>
          </Link>
          <CardTitle className="text-xl">{title}</CardTitle>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {children}
          {footer ? <div className="border-t border-line pt-4 text-sm text-muted">{footer}</div> : null}
        </CardContent>
      </Card>
    </div>
  )
}
