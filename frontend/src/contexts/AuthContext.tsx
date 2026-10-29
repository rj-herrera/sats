import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { TestingSignIn } from '@/components/TestingSignIn';
import { loadAccount, loadCurrentUser, type AccountResult } from '@/services/accountService';
import type { User } from '@/types';

interface AuthContextValue {
  user: User;
  isAuthenticated: true;
  /** Re-read the signed-in employee from the portal cookie. */
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type GateState =
  | { status: 'loading' }
  | { status: 'ready'; user: User }
  | { status: 'signedOut'; loginUrl: string }
  | { status: 'error'; message: string };

function usersAreEqual(current: User, next: User): boolean {
  return JSON.stringify(current) === JSON.stringify(next);
}

function gateFrom(result: AccountResult): GateState {
  if (result.status === 'ready') return { status: 'ready', user: result.user };
  if (result.status === 'signedOut') return { status: 'signedOut', loginUrl: result.loginUrl };
  return { status: 'error', message: result.message };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<GateState>({ status: 'loading' });

  const refreshUser = useCallback(() => {
    void loadCurrentUser().then((result) => {
      setGate((current) => {
        if (current.status !== 'ready') return current;
        if (result.status === 'ready' && usersAreEqual(current.user, result.user)) return current;
        return gateFrom(result);
      });
    });
  }, []);

  const reloadAccount = useCallback(() => {
    setGate({ status: 'loading' });
    void loadAccount().then((result) => setGate(gateFrom(result)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAccount().then((result) => {
      if (!cancelled) setGate(gateFrom(result));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gate.status !== 'ready') return undefined;
    const onFocus = () => refreshUser();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [gate.status, refreshUser]);

  if (gate.status === 'loading') {
    return <AccountStatus title="Loading your account" detail="Checking the portal sign-in." />;
  }

  if (gate.status === 'signedOut') {
    return (
      <AccountStatus
        title="Sign in required"
        detail="SATS uses your portal sign-in. After you sign in, return here."
        actionHref={gate.loginUrl}
        actionLabel="Sign in"
        onRetry={reloadAccount}
        testingSignIn
      />
    );
  }

  if (gate.status === 'error') {
    return <AccountStatus title="Account unavailable" detail={gate.message} onRetry={reloadAccount} />;
  }

  return (
    <AuthContext.Provider value={{ user: gate.user, isAuthenticated: true, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

function AccountStatus({
  title,
  detail,
  actionHref,
  actionLabel,
  onRetry,
  testingSignIn = false,
}: {
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
  onRetry?: () => void;
  /** TESTING ONLY. Remove with frontend/src/components/TestingSignIn.tsx. */
  testingSignIn?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-brand-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-brand-700">SATS</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{detail}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {actionHref && actionLabel ? (
            <a
              href={actionHref}
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              {actionLabel}
            </a>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Try again
            </button>
          ) : null}
        </div>
        {testingSignIn && onRetry ? <TestingSignIn onSignedIn={onRetry} /> : null}
      </div>
    </div>
  );
}
