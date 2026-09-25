import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/saas/AuthContext';
import type { UserRole } from '@/saas/types';

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { isAuthenticated, user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Checking session…
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { isAuthenticated, user, authReady } = useAuth();
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Checking session…
      </div>
    );
  }
  if (isAuthenticated && user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return <Outlet />;
}

export function homeForRole(role: UserRole) {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'team_member':
    case 'pro':
    case 'free':
    default:
      return '/app';
  }
}
