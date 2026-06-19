import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeRouteForRole, isProfessionalSetupPending, type AppRole } from '@/lib/roles';
import { hasPendingWeddingSetup } from '@/lib/pendingWeddingSetup';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}) {
  const { user, profile, baseProfile, availableRoles, loading } = useAuth();
  const location = useLocation();
  const hasAdminMembership =
    baseProfile?.role === 'admin'
    || availableRoles.includes('admin')
    || user?.user_metadata?.role === 'admin';

  const inferredRole = (() => {
    if (hasAdminMembership && allowedRoles?.includes('admin')) return 'admin' as AppRole;
    if (profile?.role) return profile.role;
    const requestedRole = user?.user_metadata?.role;
    if (requestedRole === 'committee') {
      return 'planner' as AppRole;
    }
    if (requestedRole === 'admin' || requestedRole === 'vendor' || requestedRole === 'planner' || requestedRole === 'couple') {
      return requestedRole as AppRole;
    }
    if (user?.user_metadata?.planner_type === 'committee' || user?.user_metadata?.planner_type === 'professional') {
      return 'planner' as AppRole;
    }
    return 'couple' as AppRole;
  })();

  const inferredPlannerType = profile?.planner_type === 'committee' || profile?.planner_type === 'professional'
    ? profile.planner_type
    : user?.user_metadata?.planner_type === 'committee' || user?.user_metadata?.planner_type === 'professional'
      ? user.user_metadata.planner_type
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <WorkspacePageSkeleton />
        </div>
      </div>
    );
  }

  if (!user) {
    if (allowedRoles?.includes('admin') && location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
    }

    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  if (hasPendingWeddingSetup(user.user_metadata, user.email ?? null) && location.pathname !== '/wedding-setup') {
    return <Navigate to="/wedding-setup" replace />;
  }

  if (isProfessionalSetupPending(user.user_metadata, profile?.role, user.email ?? null) && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }

  if (allowedRoles?.length) {
    const effectiveRoles = new Set<AppRole>(availableRoles.length ? availableRoles : [inferredRole]);
    if (hasAdminMembership) {
      effectiveRoles.add('admin');
    }

    if (!allowedRoles.some((role) => effectiveRoles.has(role) || role === inferredRole)) {
      return <Navigate to={getHomeRouteForRole(inferredRole, inferredPlannerType)} replace />;
    }
  }

  return <>{children}</>;
}
