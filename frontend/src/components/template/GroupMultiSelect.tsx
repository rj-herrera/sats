import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Group } from '@/types';

const VISIBLE_CHIPS = 5;

interface GroupMultiSelectProps {
  groups: Group[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  invalid?: boolean;
}

function menuStyleFor(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const margin = 12;
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(320, Math.max(openUp ? spaceAbove : spaceBelow, 160));
  const shared: CSSProperties = {
    position: 'fixed',
    left: rect.left,
    width: rect.width,
    maxHeight,
    zIndex: 80,
  };
  if (openUp) {
    return { ...shared, bottom: window.innerHeight - rect.top + gap };
  }
  return { ...shared, top: rect.bottom + gap };
}

function selectionLabel(count: number): string {
  if (count === 0) return 'Select groups...';
  if (count === 1) return '1 group selected';
  return `${count} groups selected`;
}

export function GroupMultiSelect({
  groups,
  selectedIds,
  onChange,
  invalid = false,
}: GroupMultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const byId = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const eligibleIds = useMemo(
    () => groups.filter((group) => group.status === 'Active').map((group) => group.id),
    [groups],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(q));
  }, [groups, query]);

  const visibleChips = selectedIds.slice(0, VISIBLE_CHIPS);
  const hiddenCount = Math.max(0, selectedIds.length - VISIBLE_CHIPS);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      if (!buttonRef.current) return;
      setMenuStyle(menuStyleFor(buttonRef.current));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const canToggle = (group: Group) =>
    group.status === 'Active' || selectedIds.includes(group.id);

  const toggle = (groupId: string) => {
    const group = byId.get(groupId);
    if (!group || !canToggle(group)) return;
    if (selectedIds.includes(groupId)) {
      onChange(selectedIds.filter((id) => id !== groupId));
    } else {
      onChange([...selectedIds, groupId]);
    }
  };

  const close = () => {
    setOpen(false);
    setQuery('');
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="space-y-2">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((current) => !current)}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm',
          invalid
            ? 'border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20'
            : open
              ? 'border-brand-500 ring-2 ring-brand-500/20'
              : 'border-brand-200 hover:bg-brand-50',
        ].join(' ')}
      >
        <span className={selectedIds.length === 0 ? 'text-brand-400' : 'text-brand-900'}>
          {selectionLabel(selectedIds.length)}
        </span>
        <ChevronDown
          size={16}
          className={[
            'shrink-0 text-brand-500 transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden
        />
      </button>

      {selectedIds.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected groups">
          {visibleChips.map((id) => {
            const name = byId.get(id)?.name ?? id;
            return (
              <li key={id}>
                <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-brand-200 bg-brand-50 py-0.5 pr-1 pl-2 text-xs text-brand-800">
                  <span className="truncate">{name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => onChange(selectedIds.filter((selected) => selected !== id))}
                    className="rounded p-0.5 text-brand-500 hover:bg-white hover:text-brand-900"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </span>
              </li>
            );
          })}
          {hiddenCount > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-md border border-brand-200 bg-white px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                +{hiddenCount} more
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="flex flex-col overflow-hidden rounded-md border border-brand-200 bg-white shadow-lg"
            >
              <div className="shrink-0 border-b border-brand-100 p-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-brand-400"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    autoComplete="off"
                    placeholder="Search groups..."
                    aria-label="Search groups"
                    aria-controls={listId}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveIndex((index) =>
                          Math.min(index + 1, Math.max(results.length - 1, 0)),
                        );
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveIndex((index) => Math.max(index - 1, 0));
                      } else if (event.key === 'Enter') {
                        event.preventDefault();
                        const pick = results[activeIndex];
                        if (pick) toggle(pick.id);
                      }
                    }}
                    className="w-full rounded-md border border-brand-200 bg-white py-1.5 pr-2 pl-8 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>
              <ul
                id={listId}
                role="listbox"
                aria-multiselectable="true"
                aria-label="Groups"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
              >
                {results.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-brand-500">
                    No matching groups found
                  </li>
                ) : (
                  results.map((group, index) => {
                    const selected = selectedIds.includes(group.id);
                    const disabled = !canToggle(group);
                    const active = index === activeIndex;
                    return (
                      <li key={group.id} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          disabled={disabled}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => toggle(group.id)}
                          className={[
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                            disabled
                              ? 'cursor-not-allowed text-brand-400'
                              : active || selected
                                ? 'bg-brand-50 text-brand-900'
                                : 'text-brand-900 hover:bg-brand-50',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              selected
                                ? 'border-brand-700 bg-brand-900 text-white'
                                : 'border-brand-300 bg-white',
                            ].join(' ')}
                            aria-hidden
                          >
                            {selected ? <Check size={12} strokeWidth={3} /> : null}
                          </span>
                          <span className="min-w-0 truncate">
                            {group.name}
                            {group.status !== 'Active' ? ' (Inactive)' : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-brand-100 px-2 py-1.5">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onChange(eligibleIds)}
                    className="rounded px-2 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="rounded px-2 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50"
                  >
                    Clear
                  </button>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded bg-brand-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-800"
                >
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
