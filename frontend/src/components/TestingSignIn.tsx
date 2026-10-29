/**
 * TESTING ONLY. Delete this file when portal login is the only sign-in.
 * Also remove the pieces listed at the top of backend/DevLogin.php.
 */
import { useState, type FormEvent } from 'react';
import { devSignIn } from '@/services/accountService';

export function TestingSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    void devSignIn(employeeId).then((message) => {
      setPending(false);
      if (message) {
        setError(message);
        return;
      }
      onSignedIn();
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 border-t border-brand-100 pt-6 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Testing only</p>
      <label htmlFor="testing-employee-id" className="mt-2 block text-sm font-medium text-slate-700">
        Employee ID
      </label>
      <input
        id="testing-employee-id"
        value={employeeId}
        onChange={(event) => setEmployeeId(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm text-slate-900"
      />
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in for testing'}
      </button>
    </form>
  );
}
