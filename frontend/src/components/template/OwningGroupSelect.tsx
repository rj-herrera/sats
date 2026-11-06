import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import type { Group } from '@/types';

interface OwningGroupSelectProps {
  groups: Group[];
  value: string;
  invalid?: boolean;
  onChange: (groupId: string) => void;
}

function groupLabel(group: Group): string {
  return group.status === 'Active' ? group.name : `${group.name} (Inactive)`;
}

function menuStyleFor(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const margin = 12;
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(280, Math.max(openUp ? spaceAbove : spaceBelow, 80));
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

export function OwningGroupSelect({
  groups,
  value,
  invalid = false,
  onChange,
}: OwningGroupSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const selectedIndex = useMemo(
    () => groups.findIndex((group) => group.id === value),
    [groups, value],
  );
  const selected = selectedIndex >= 0 ? groups[selectedIndex] : undefined;

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const anchor = buttonRef.current;
      if (!anchor) return;
      setMenuStyle(menuStyleFor(anchor));
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
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = menuRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const choose = (group: Group) => {
    if (group.status !== 'Active') return;
    onChange(group.id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (groups.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, groups.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      if (!open) return;
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      setActiveIndex(groups.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const pick = groups[activeIndex];
      if (pick) choose(pick);
    } else if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-md border bg-white py-2 pr-3 pl-3 text-left text-sm focus:outline-none focus:ring-2',
          invalid
            ? 'border-red-400 focus:ring-red-500/20'
            : open
              ? 'border-brand-500 ring-2 ring-brand-500/20'
              : 'border-brand-200 focus:border-brand-500 focus:ring-brand-500/20',
          selected ? 'text-brand-900' : 'text-brand-400',
        ].join(' ')}
      >
        <span className="min-w-0 truncate">
          {selected ? groupLabel(selected) : 'Select owning group'}
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
      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="overflow-y-auto overscroll-contain rounded-md border border-brand-200 bg-white py-1 shadow-lg"
            >
              <ul id={listId} role="listbox" aria-label="Owning group">
                {groups.map((group, index) => {
                  const isSelected = group.id === value;
                  const disabled = group.status !== 'Active';
                  const active = index === activeIndex;
                  return (
                    <li
                      key={group.id}
                      id={`${listId}-option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={disabled || undefined}
                      data-active={active ? 'true' : undefined}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(group)}
                        className={[
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                          disabled
                            ? 'cursor-not-allowed text-brand-400'
                            : 'text-brand-900',
                          !disabled && active ? 'bg-brand-50' : '',
                          !disabled && !active ? 'hover:bg-brand-50' : '',
                        ].join(' ')}
                      >
                        <span className="min-w-0">{groupLabel(group)}</span>
                        {isSelected ? (
                          <Check size={15} className="shrink-0 text-brand-700" aria-hidden />
                        ) : (
                          <span className="w-[15px] shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
