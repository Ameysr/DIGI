import { Suspense, lazy } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { RequireAdmin } from '@/components/guards/RequireAdmin'
import { RequireActiveSubscription } from '@/components/guards/RequireActiveSubscription'
import { RequireAuth } from '@/components/guards/RequireAuth'
import { AdminLayout, AppLayout } from '@/components/layout/AppLayout'
import { MarketingLayout } from '@/components/layout/MarketingLayout'
import { FullPageSpinner } from '@/components/ui/spinner'

// The homepage is imported eagerly because it is the landing route and the one
// users hit first; lazy-loading it would add a round trip to the critical path.
import { Home } from '@/routes/marketing/Home'

/*
 * Everything else is code-split by route. This keeps the initial download small
 * and, more usefully, keeps heavy dependencies out of it entirely — recharts is
 * only pulled in when an administrator opens the overview.
 */
const Charities = lazy(() =>
  import('@/routes/marketing/Charities').then((module) => ({ default: module.Charities })),
)
const CharityProfile = lazy(() =>
  import('@/routes/marketing/CharityProfile').then((module) => ({ default: module.CharityProfile })),
)
const Login = lazy(() =>
  import('@/routes/auth/Login').then((module) => ({ default: module.Login })),
)
const Signup = lazy(() =>
  import('@/routes/auth/Signup').then((module) => ({ default: module.Signup })),
)
const Onboarding = lazy(() =>
  import('@/routes/auth/Onboarding').then((module) => ({ default: module.Onboarding })),
)
const Dashboard = lazy(() =>
  import('@/routes/app/Dashboard').then((module) => ({ default: module.Dashboard })),
)
const Scores = lazy(() =>
  import('@/routes/app/Scores').then((module) => ({ default: module.Scores })),
)
const Draws = lazy(() =>
  import('@/routes/app/Draws').then((module) => ({ default: module.Draws })),
)
const MyCharity = lazy(() =>
  import('@/routes/app/MyCharity').then((module) => ({ default: module.MyCharity })),
)
const SubscriptionPage = lazy(() =>
  import('@/routes/app/SubscriptionPage').then((module) => ({
    default: module.SubscriptionPage,
  })),
)
const Winnings = lazy(() =>
  import('@/routes/app/Winnings').then((module) => ({ default: module.Winnings })),
)
const AdminOverview = lazy(() =>
  import('@/routes/admin/AdminOverview').then((module) => ({ default: module.AdminOverview })),
)
const AdminUsers = lazy(() =>
  import('@/routes/admin/AdminUsers').then((module) => ({ default: module.AdminUsers })),
)
const AdminDraws = lazy(() =>
  import('@/routes/admin/AdminDraws').then((module) => ({ default: module.AdminDraws })),
)
const AdminDrawDetail = lazy(() =>
  import('@/routes/admin/AdminDrawDetail').then((module) => ({
    default: module.AdminDrawDetail,
  })),
)
const AdminCharities = lazy(() =>
  import('@/routes/admin/AdminCharities').then((module) => ({ default: module.AdminCharities })),
)
const AdminWinners = lazy(() =>
  import('@/routes/admin/AdminWinners').then((module) => ({ default: module.AdminWinners })),
)
const NotFound = lazy(() =>
  import('@/routes/NotFound').then((module) => ({ default: module.NotFound })),
)

export function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/charities" element={<Charities />} />
          <Route path="/charities/:slug" element={<CharityProfile />} />
        </Route>

        {/*
          Login and Signup handle their own redirect when already signed in, so
          they need no wrapper here.
        */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />

        {/* Subscriber area. Everything except /subscription needs an active plan,
            because a lapsed subscription must not lock you out of renewing. */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/subscription" element={<SubscriptionPage />} />

          <Route
            element={
              <RequireActiveSubscription>
                <Outlet />
              </RequireActiveSubscription>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scores" element={<Scores />} />
            <Route path="/draws" element={<Draws />} />
            <Route path="/charity" element={<MyCharity />} />
            <Route path="/winnings" element={<Winnings />} />
          </Route>
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="draws" element={<AdminDraws />} />
          <Route path="draws/:drawId" element={<AdminDrawDetail />} />
          <Route path="charities" element={<AdminCharities />} />
          <Route path="winners" element={<AdminWinners />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
