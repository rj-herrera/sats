import { Check } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastMessage {
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: ToastMessage | null;
  showToast: (toast: ToastMessage) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const cardTone: Record<ToastTone, string> = {
  success: 'border-emerald-400 bg-emerald-50',
  info: 'border-sky-400 bg-sky-50',
  error: 'border-red-400 bg-red-50',
};

const iconTone: Record<ToastTone, string> = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  error: 'bg-red-500',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number | null>(null);

  const showToast = useCallback((next: ToastMessage) => {
    setToast(next);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const value = useMemo(() => ({ toast, showToast }), [toast, showToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-white ${iconTone[tone]}`}
    >
      {tone === 'success' ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
      {tone === 'info' ? (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
          <circle cx="12" cy="7" r="1.7" />
          <rect x="10.5" y="10.2" width="3" height="8" rx="1.5" />
        </svg>
      ) : null}
      {tone === 'error' ? (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
          <rect x="10.5" y="4" width="3" height="10.2" rx="1.5" />
          <circle cx="12" cy="18.4" r="1.7" />
        </svg>
      ) : null}
    </span>
  );
}

export function ToastBanner() {
  const { toast } = useToast();
  if (!toast) return null;

  return (
    <div className="pointer-events-none absolute top-4 right-4 z-40 w-96 max-w-[calc(100%-2rem)]">
      <div
        role="status"
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm ${cardTone[toast.tone]}`}
      >
        <ToastIcon tone={toast.tone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-sm text-slate-500">{toast.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used within ToastProvider.');
  }
  return value;
}
