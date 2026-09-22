import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth/context'
import { cn } from '@/lib/utils'

/**
 * Avatar menu for the signed-in user.
 *
 * Replaces the identity provider's hosted button. Signing out is handled by
 * Supabase Auth and the redirect is done here, so there is no provider-specific
 * navigation to reason about.
 */
export function UserMenu({ showName = false }: { showName?: boolean }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const label = user.fullName ?? user.email ?? 'Account'
  const initial = label.trim().charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          showName ? 'pr-3' : '',
        )}
        aria-label="Account menu"
      >
        <span className="grid size-8 place-items-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
          {initial}
        </span>
        {showName ? <span className="text-sm text-ink">{label}</span> : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/dashboard')}>Dashboard</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate('/'))
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
