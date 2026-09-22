import { Shield } from 'lucide-react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ADMIN_NAV, APP_NAV } from '@/components/layout/navItems'
import { useProfile } from '@/lib/hooks/useProfile'

export function AppLayout() {
  const { isAdmin } = useProfile()

  const nav = isAdmin
    ? [...APP_NAV, { to: '/admin', label: 'Admin', icon: Shield }]
    : APP_NAV

  return <DashboardShell nav={nav} />
}

export function AdminLayout() {
  return (
    <DashboardShell
      nav={ADMIN_NAV}
      secondaryLink={{ to: '/dashboard', label: 'Back to my dashboard' }}
    />
  )
}
