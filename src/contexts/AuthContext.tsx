import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ensureMockSession,
  loginAsMockUser,
  refreshSessionUser,
  switchMockRole,
} from '@/services/authService';
import type { Role, User } from '@/types';

interface AuthContextValue {
  user: User;
  isAuthenticated: true;
  /** Switch to the default mock user for a role (first in that role's list). */
  switchRole: (role: Role) => void;
  /** Switch to a specific mock user (same-role or cross-role). */
  switchUser: (userId: string) => void;
  /** Re-resolve the logged-in user from the directory. */
  refreshUser: () => void;
  /** @deprecated Prefer switchUser — kept for older call sites. */
  login: (userId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Directory re-reads always allocate a new object. Keep the previous one when nothing changed. */
function usersAreEqual(current: User, next: User): boolean {
  return JSON.stringify(current) === JSON.stringify(next);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(() => ensureMockSession());

  const commitSessionUser = useCallback((next: User) => {
    setUser((current) => (usersAreEqual(current, next) ? current : next));
  }, []);

  const switchUser = useCallback((userId: string) => {
    setUser(loginAsMockUser(userId));
  }, []);

  const login = switchUser;

  const switchRole = useCallback((role: Role) => {
    setUser(switchMockRole(role));
  }, []);

  const refreshUser = useCallback(() => {
    commitSessionUser(refreshSessionUser());
  }, [commitSessionUser]);

  useEffect(() => {
    const onFocus = () => commitSessionUser(refreshSessionUser());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [commitSessionUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: true,
      switchRole,
      switchUser,
      refreshUser,
      login,
    }),
    [user, switchRole, switchUser, refreshUser, login],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
