import { Link, NavLink, Outlet } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { UserMenu } from '@/components/layout/UserMenu'
import type { NavItem } from '@/components/layout/navItems'
import { cn } from '@/lib/utils'

/**
 * Chrome shared by the subscriber and admin areas.
 *
 * Desktop gets a persistent sidebar; small screens get a horizontally
 * scrollable nav band, which keeps every section reachable without a
 * hamburger menu hiding them.
 */
export function DashboardShell({
  nav,
  secondaryLink,
  children,
}: {
  nav: NavItem[]
  secondaryLink?: { to: string; label: string }
  children?: React.ReactNode
}) {
  function navLinkClass({ isActive }: { isActive: boolean }) {
    return cn(
      'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-white/[0.08] text-ink' : 'text-muted hover:bg-white/[0.05] hover:text-ink',
    )
  }

  return (
    <div className="aurora min-h-dvh">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:flex-row lg:gap-10 lg:px-8 lg:py-8">
        <aside className="lg:w-56 lg:shrink-0">
          <div className="flex items-center justify-between gap-4">
            <Logo />
            <div className="lg:hidden">
              <UserMenu />
            </div>
          </div>

          <nav aria-label="Sections" className="mt-5 hidden lg:block">
            <ul className="flex flex-col gap-1">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={navLinkClass}>
                    <item.icon className="size-4" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            {secondaryLink ? (
              <div className="mt-4 border-t border-line pt-4">
                <Link
                  to={secondaryLink.to}
                  className="text-sm text-muted transition-colors hover:text-accent"
                >
                  ← {secondaryLink.label}
                </Link>
              </div>
            ) : null}

            <div className="mt-6 border-t border-line pt-4">
              <UserMenu showName />
            </div>
          </nav>
        </aside>

        {/* Small screens: one scrollable band instead of a hidden menu. */}
        <nav aria-label="Sections" className="lg:hidden">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={navLinkClass}>
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">{children ?? <Outlet />}</main>
      </div>
    </div>
  )
}
