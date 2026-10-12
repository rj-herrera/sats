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
  /** Switch mock persona for development/testing. */
  switchRole: (role: Role) => void;
  /** Re-resolve the logged-in user from the directory. */
  refreshUser: () => void;
  /** @deprecated Prefer switchRole — kept for tests that set a specific user. */
  login: (userId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(() => ensureMockSession());

  const login = useCallback((userId: string) => {
    setUser(loginAsMockUser(userId));
  }, []);

  const switchRole = useCallback((role: Role) => {
    setUser(switchMockRole(role));
  }, []);

  const refreshUser = useCallback(() => {
    setUser(refreshSessionUser());
  }, []);

  useEffect(() => {
    const onFocus = () => setUser(refreshSessionUser());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: true,
      switchRole,
      refreshUser,
      login,
    }),
    [user, switchRole, refreshUser, login],
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
