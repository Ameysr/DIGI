import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="aurora flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">404</p>
      <h1 className="max-w-lg text-3xl font-semibold text-display text-ink">
        We could not find that page
      </h1>
      <p className="max-w-md text-sm text-muted">
        The link may be out of date, or the page may have moved.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/charities">Browse charities</Link>
        </Button>
      </div>
    </div>
  )
}
