import {
  BadgeCheck,
  CreditCard,
  Gauge,
  HeartHandshake,
  LayoutDashboard,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Match this route exactly rather than as a prefix (used by index routes). */
  end?: boolean
}

export const APP_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scores', label: 'My scores', icon: Target },
  { to: '/draws', label: 'Draws', icon: Trophy },
  { to: '/charity', label: 'My charity', icon: HeartHandshake },
  { to: '/winnings', label: 'Winnings', icon: BadgeCheck },
  { to: '/subscription', label: 'Subscription', icon: CreditCard },
]

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/draws', label: 'Draws', icon: Trophy },
  { to: '/admin/charities', label: 'Charities', icon: HeartHandshake },
  { to: '/admin/winners', label: 'Winners', icon: BadgeCheck },
]
