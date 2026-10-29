import type { ReactNode } from 'react';

/** Standard scrollable page body with layout padding. */
export function PageScroll({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
  );
}
