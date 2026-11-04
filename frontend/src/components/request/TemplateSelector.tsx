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
import type { FormTemplate } from '@/types';

interface TemplateSelectorProps {
  templates: FormTemplate[];
  value: string;
  onChange: (templateId: string) => void;
  description?: string;
}

interface TemplateChoice {
  id: string;
  label: string;
}

function optionLabel(template: FormTemplate): string {
  return `${template.name}${template.scope === 'group' ? ' (Group)' : ' (Shared)'}`;
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

export function TemplateSelector({
  templates,
  value,
  onChange,
  description,
}: TemplateSelectorProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const trimmedDescription = description?.trim();

  const choices = useMemo<TemplateChoice[]>(
    () => [
      { id: '', label: 'Select a template…' },
      ...templates.map((template) => ({ id: template.id, label: optionLabel(template) })),
    ],
    [templates],
  );

  const selectedIndex = Math.max(
    0,
    choices.findIndex((choice) => choice.id === value),
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

  const choose = (templateId: string) => {
    onChange(templateId);
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
      if (pick) choose(pick.id);
    } else if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <label htmlFor="template-select" className="block text-sm font-medium text-brand-800">
        Form template <span className="text-red-600">*</span>
      </label>
      <div ref={rootRef} className="relative mt-1.5">
        <button
          ref={buttonRef}
          id="template-select"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          className={[
            'flex w-full items-center justify-between gap-2 rounded-md border bg-white py-2 pr-3 pl-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            open ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-brand-200',
            value ? 'text-brand-900' : 'text-brand-400',
          ].join(' ')}
        >
          <span className="min-w-0 truncate">{selected?.label ?? 'Select a template…'}</span>
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
                <ul id={listId} role="listbox" aria-label="Form template">
                  {choices.map((choice, index) => {
                    const selectedChoice = choice.id === value;
                    const active = index === activeIndex;
                    return (
                      <li
                        key={choice.id || 'none'}
                        id={`${listId}-option-${index}`}
                        role="option"
                        aria-selected={selectedChoice}
                        data-active={active ? 'true' : undefined}
                      >
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => choose(choice.id)}
                          className={[
                            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                            choice.id ? 'text-brand-900' : 'text-brand-500',
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
      {trimmedDescription ? (
        <p className="mt-2 text-sm leading-relaxed text-brand-600">{trimmedDescription}</p>
      ) : null}
    </section>
  );
}
