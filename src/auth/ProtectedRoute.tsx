import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { FullscreenLoader } from '../components/FullscreenLoader'
import type { UserRole } from '../types/database'

function homePathFor(role: UserRole) {
  if (role === 'admin') return '/admin'
  if (role === 'professor') return '/professor'
  return '/aluno'
}

export function ProtectedRoute({ role }: { role?: UserRole | UserRole[] }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullscreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/onboarding" replace />
  if (role) {
    const permitido = Array.isArray(role) ? role.includes(profile.role) : profile.role === role
    if (!permitido) return <Navigate to={homePathFor(profile.role)} replace />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullscreenLoader />
  if (session && profile) return <Navigate to={homePathFor(profile.role)} replace />
  if (session && !profile) return <Navigate to="/onboarding" replace />

  return <Outlet />
}

export function OnboardingRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullscreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (profile) return <Navigate to={homePathFor(profile.role)} replace />

  return <Outlet />
}

export function CatchAllRedirect() {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullscreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/onboarding" replace />

  return <Navigate to={homePathFor(profile.role)} replace />
}
