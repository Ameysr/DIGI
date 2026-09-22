import { Shield, ShieldOff, Users } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/stat'
import { SubscriptionBadge } from '@/components/ui/status-badges'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { describeDbError } from '@/lib/errors'
import { useAllUsers, useUpdateUserRole } from '@/lib/hooks/useAdmin'
import type { UserRole } from '@/lib/types'
import { formatCents, formatDate } from '@/lib/utils'

export function AdminUsers() {
  const { data: users, isLoading, isError, error } = useAllUsers()
  const updateRole = useUpdateUserRole()
  const [search, setSearch] = useState('')

  const filtered = (users ?? []).filter((user) => {
    if (!search.trim()) return true
    const term = search.trim().toLowerCase()
    return (
      (user.full_name ?? '').toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
    )
  })

  async function changeRole(userId: string, role: UserRole) {
    await updateRole.mutateAsync({ userId, role }).catch(() => {})
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display text-3xl text-ink">Users</h1>
        <p className="text-sm text-muted">
          Every profile, with its subscription state. Roles are enforced in the database, so a
          change here takes effect immediately.
        </p>
      </header>

      {updateRole.isError ? (
        <Alert tone="danger" title="Could not change that role">
          {describeDbError(updateRole.error)}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{filtered.length} users</CardTitle>
            <div className="w-full sm:w-64">
              <Input
                type="search"
                placeholder="Search name or email"
                aria-label="Search users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-danger">
              {error instanceof Error ? error.message : 'Could not load users.'}
            </p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users match"
              description="Try a different search term."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">
                          {user.full_name ?? 'Unnamed'}
                        </span>
                        <span className="text-xs text-muted">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <SubscriptionBadge status={user.subscriptions?.status ?? 'inactive'} />
                    </TableCell>
                    <TableCell className="capitalize">
                      {user.subscriptions?.plan ?? '—'}
                      {user.subscriptions ? (
                        <span className="ml-2 text-xs text-muted">
                          {formatCents(user.subscriptions.amount_cents)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted">
                      {user.subscriptions?.current_period_end
                        ? formatDate(user.subscriptions.current_period_end)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(value) => changeRole(user.id, value as UserRole)}
                          options={[
                            { value: 'subscriber', label: 'Subscriber' },
                            { value: 'admin', label: 'Administrator' },
                          ]}
                          className="h-8 w-40 text-xs"
                        />
                        {user.role === 'admin' ? (
                          <Badge tone="accent">
                            <Shield />
                            Admin
                          </Badge>
                        ) : (
                          <Badge tone="muted">
                            <ShieldOff />
                            Standard
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
