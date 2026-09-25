import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/saas/AuthContext';
import { GuestOnlyRoute, ProtectedRoute, homeForRole } from '@/saas/ProtectedRoute';
import { LoginPage } from '@/saas/pages/LoginPage';
import { SignupPage } from '@/saas/pages/SignupPage';
import { AdminLayout, SuperAdminLayout } from '@/saas/layouts/PanelLayout';
import { SuperAdminOverview } from '@/saas/pages/SuperAdminOverview';
import { AdminOverview } from '@/saas/pages/AdminOverview';
import { PlansPage } from '@/saas/pages/PlansPage';
import { UsersPage } from '@/saas/pages/UsersPage';
import { AuditLogPage } from '@/saas/pages/AuditLogPage';
import { SystemSettingsPage } from '@/saas/pages/SystemSettingsPage';
import { BillingPlansPage } from '@/saas/pages/BillingPlansPage';
import { AccountPage } from '@/saas/pages/AccountPage';
import { TeamMembersPage } from '@/saas/pages/TeamMembersPage';
import OrderApp from './OrderApp';

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={homeForRole(user.role)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={['super_admin']} />}>
        <Route path="/super-admin" element={<SuperAdminLayout />}>
          <Route index element={<SuperAdminOverview />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="users" element={<UsersPage mode="super_admin" />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="settings" element={<SystemSettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<UsersPage mode="admin" />} />
          <Route path="billing" element={<BillingPlansPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['super_admin', 'admin', 'pro', 'free', 'team_member']} />}>
        <Route path="/app" element={<OrderApp />} />
        <Route
          path="/app/billing"
          element={
            <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
              <div className="mx-auto max-w-6xl">
                <BillingPlansPage />
              </div>
            </div>
          }
        />
        <Route
          path="/app/account"
          element={
            <div className="min-h-screen bg-slate-50">
              <AccountPage />
            </div>
          }
        />
        <Route
          path="/app/team"
          element={
            <div className="min-h-screen bg-slate-50">
              <TeamMembersPage />
            </div>
          }
        />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
