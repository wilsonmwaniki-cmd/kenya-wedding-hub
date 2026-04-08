import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { getHomeRouteForRole, type AppRole } from '@/lib/roles';

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  const inferredRole = (() => {
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;

  if (allowedRoles?.length) {
    if (!allowedRoles.includes(inferredRole)) {
      return <Navigate to={getHomeRouteForRole(inferredRole, inferredPlannerType)} replace />;
    }
  }

  return <>{children}</>;
}
