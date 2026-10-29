import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { User } from '@/types';
import { formatReviewerRole } from '@/services/workflowService';

interface ReviewerSelectorProps {
  candidates: User[];
  selectedIds: string[];
  error?: string | null;
  onChange: (selectedIds: string[]) => void;
}

function matchesQuery(user: User, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const haystack = [user.name, user.email, user.groupName, formatReviewerRole(user)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function ReviewerSelector({
  candidates,
  selectedIds,
  error,
  onChange,
}: ReviewerSelectorProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => candidates.filter((u) => selectedIds.includes(u.id)),
    [candidates, selectedIds],
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return candidates.filter(
      (user) => !selectedIds.includes(user.id) && matchesQuery(user, query),
    );
  }, [candidates, query, selectedIds]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const selectUser = (userId: string) => {
    if (selectedIds.includes(userId)) return;
    onChange([...selectedIds, userId]);
    setQuery('');
    setOpen(false);
  };

  const removeSelected = (userId: string) => {
    onChange(selectedIds.filter((id) => id !== userId));
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <section className="flex h-full flex-col rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">
        Select Reviewers / Approvers
      </h2>

      <div ref={rootRef} className="relative mt-4">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-brand-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Search employees by name, group, or role…"
          className="w-full rounded-md border border-brand-200 bg-white py-2 pr-3 pl-9 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          aria-label="Search reviewers and approvers"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showDropdown) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const pick = results[activeIndex];
              if (pick) selectUser(pick.id);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />

        {showDropdown && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-brand-200 bg-white py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-brand-500">
                No employees match “{query.trim()}”.
              </li>
            ) : (
              results.map((user, index) => (
                <li key={user.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={[
                      'flex w-full flex-col px-3 py-2 text-left',
                      index === activeIndex ? 'bg-brand-50' : 'hover:bg-brand-50',
                    ].join(' ')}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectUser(user.id)}
                  >
                    <span className="text-sm font-medium text-brand-900">{user.name}</span>
                    <span className="text-xs text-brand-500">
                      {user.groupName} · {formatReviewerRole(user)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="mt-4 min-h-[2.5rem]">
        {selected.length === 0 ? (
          <p className="rounded-md border border-dashed border-brand-200 px-3 py-3 text-sm text-brand-500">
            No reviewers selected yet. Use the search field above to add people.
          </p>
        ) : (
          <ul className="divide-y divide-brand-100 rounded-md border border-brand-100">
            {selected.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-brand-900">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeSelected(user.id)}
                  className="shrink-0 rounded p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-800"
                  aria-label={`Remove ${user.name}`}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
