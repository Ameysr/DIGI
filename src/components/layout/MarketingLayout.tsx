import { Link, Outlet } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

export function MarketingLayout() {
  const { isSignedIn } = useAuth()

  return (
    <div className="aurora flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-night/70 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
            <a
              href="/#how"
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              How it works
            </a>
            <a href="/#prizes" className="text-sm text-muted transition-colors hover:text-ink">
              Prizes
            </a>
            <Link to="/charities" className="text-sm text-muted transition-colors hover:text-ink">
              Charities
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Button asChild variant="secondary" size="sm">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <UserMenu />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  {/*
                    Points at sign-in rather than sign-up: the sign-in page is the
                    single way in, offering the demo account and a link through to
                    registration. One door means a reviewer always lands where the
                    demo button is.
                  */}
                  <Link to="/login">Subscribe</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <Logo />
              <p className="max-w-sm text-sm text-muted">
                Every round you play funds a charity you choose — and enters you into the monthly
                draw.
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/charities" className="text-sm text-muted hover:text-ink">
                Charities
              </Link>
              <Link to="/login" className="text-sm text-muted hover:text-ink">
                Subscribe
              </Link>
            </nav>
          </div>
          <p className="text-xs text-muted">
            A demonstration platform built for the Digital Heroes trainee selection process. Figures
            and charities shown are illustrative.
          </p>
        </div>
      </footer>
    </div>
  )
}
