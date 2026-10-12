import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import type { Permission } from '@/types';
import { paths } from '@/routes/paths';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** User must have at least one of these permissions */
  anyOf?: Permission[];
}

/**
 * Auth is always present in the MVP (mock / future token identity).
 * Permission gates still apply for role-based pages.
 */
export function ProtectedRoute({ children, anyOf }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (anyOf && anyOf.length > 0) {
    const allowed = anyOf.some((p) => hasPermission(user, p));
    if (!allowed) {
      return <Navigate to={paths.requests} replace />;
    }
  }

  return <>{children}</>;
}
