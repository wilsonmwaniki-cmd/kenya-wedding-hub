import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

type Role = 'couple' | 'planner' | 'vendor';

function roleHome(role: Role) {
  if (role === 'planner') return '/clients';
  if (role === 'vendor') return '/vendor-settings';
  return '/dashboard';
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;

  if (allowedRoles?.length) {
    if (!profile?.role) {
      return <Navigate to="/auth" replace />;
    }

    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to={roleHome(profile.role)} replace />;
    }
  }

  return <>{children}</>;
}
