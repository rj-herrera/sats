import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

interface FieldOption {
  value: string;
  label: string;
}

interface FieldOptionSelectProps {
  id: string;
  value: string;
  prompt: string;
  options: FieldOption[];
  invalid?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

function menuSpace(anchor: HTMLElement): { below: number; above: number } {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const margin = 12;
  let belowLimit = window.innerHeight - margin;
  const bar = anchor.closest('main')?.querySelector<HTMLElement>('[data-action-bar]');
  if (bar) {
    const barTop = bar.getBoundingClientRect().top;
    if (barTop > rect.top) belowLimit = Math.min(belowLimit, barTop - margin);
  }
  return {
    below: belowLimit - rect.bottom - gap,
    above: rect.top - gap - margin,
  };
}

function menuStyleFor(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const { below: spaceBelow, above: spaceAbove } = menuSpace(anchor);
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

export function FieldOptionSelect({
  id,
  value,
  prompt,
  options,
  invalid = false,
  describedBy,
  onChange,
}: FieldOptionSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const choices: FieldOption[] = [{ value: '', label: prompt }, ...options];
  const selectedIndex = Math.max(
    0,
    choices.findIndex((choice) => choice.value === value),
  );
  const selected = choices[selectedIndex] ?? choices[0];

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

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const openMenu = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, choices.length - 1));
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
      setActiveIndex(choices.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const pick = choices[activeIndex];
      if (pick) choose(pick.value);
    } else if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-md border bg-white py-2 pr-3 pl-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          open ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-brand-200',
          selected.value ? 'text-brand-900' : 'text-brand-400',
        ].join(' ')}
      >
        <span className="min-w-0 truncate">{selected.label}</span>
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
              <ul id={listId} role="listbox">
                {choices.map((choice, index) => {
                  const selectedChoice = choice.value === value;
                  const active = index === activeIndex;
                  return (
                    <li
                      key={choice.value || 'prompt'}
                      id={`${listId}-option-${index}`}
                      role="option"
                      aria-selected={selectedChoice}
                      data-active={active ? 'true' : undefined}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(choice.value)}
                        className={[
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                          choice.value ? 'text-brand-900' : 'text-brand-500',
                          active ? 'bg-brand-50' : 'hover:bg-brand-50',
                        ].join(' ')}
                      >
                        <span className="min-w-0">{choice.label}</span>
                        {selectedChoice ? (
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
