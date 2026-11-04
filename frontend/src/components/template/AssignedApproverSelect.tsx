import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { getGroupById, listActiveGroups } from '@/services/groupRepository';
import { getUserById, listAssignableUsers } from '@/services/userRepository';
import type { User } from '@/types';

const ALL_GROUPS = '__all__';

interface AssignedApproverSelectProps {
  assigneeUserId: string;
  onChange: (assigneeUserId: string) => void;
  /** Focus the employee control when this row is newly opened for editing. */
  autoFocus?: boolean;
}

interface GroupOption {
  id: string;
  code: string;
  name: string;
}

function employeeBelongsToGroup(user: User, groupId: string): boolean {
  if (groupId === ALL_GROUPS) return true;
  if (user.groupId === groupId) return true;
  return user.groupIds?.includes(groupId) ?? false;
}

function displayCode(code: string, name: string): string {
  const acronym = code.trim().toUpperCase();
  if (acronym) return acronym;
  const letters = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return letters.slice(0, 3) || 'GRP';
}

function groupOptions(assignee: User | undefined): GroupOption[] {
  const groups = [...listActiveGroups()];
  if (assignee) {
    const current = getGroupById(assignee.groupId);
    if (current && !groups.some((group) => group.id === current.id)) {
      groups.push(current);
    }
  }

  const options = groups
    .map((group) => ({
      id: group.id,
      code: displayCode(group.code, group.name),
      name: group.name,
    }))
    .sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));

  return [{ id: ALL_GROUPS, code: 'ALL', name: 'All groups' }, ...options];
}

function menuStyleFor(anchor: HTMLElement, minWidth: number): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const margin = 12;
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(240, Math.max(openUp ? spaceAbove : spaceBelow, 80));
  const shared: CSSProperties = {
    position: 'fixed',
    left: rect.left,
    width: Math.max(rect.width, minWidth),
    maxHeight,
    zIndex: 80,
  };
  if (openUp) {
    return { ...shared, bottom: window.innerHeight - rect.top + gap };
  }
  return { ...shared, top: rect.bottom + gap };
}

function employeesInGroup(groupId: string, assigneeUserId: string): User[] {
  const people = listAssignableUsers().filter((user) =>
    employeeBelongsToGroup(user, groupId),
  );
  if (!assigneeUserId || people.some((user) => user.id === assigneeUserId)) {
    return people;
  }
  const selected = getUserById(assigneeUserId);
  if (!selected || !employeeBelongsToGroup(selected, groupId)) return people;
  return [...people, selected].sort((a, b) => a.name.localeCompare(b.name));
}

export function AssignedApproverSelect({
  assigneeUserId,
  onChange,
  autoFocus = false,
}: AssignedApproverSelectProps) {
  const listId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const employeeButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const assignee = assigneeUserId ? getUserById(assigneeUserId) : undefined;
  const options = useMemo(() => groupOptions(assignee), [assignee]);
  const [groupId, setGroupId] = useState(ALL_GROUPS);
  const [open, setOpen] = useState<'group' | 'employee' | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const employees = useMemo(
    () => employeesInGroup(groupId, assigneeUserId),
    [groupId, assigneeUserId],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((user) => user.name.toLowerCase().includes(q));
  }, [employees, query]);

  const selectedGroup = options.find((option) => option.id === groupId) ?? options[0];

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const current = open === 'group' ? groupButtonRef.current : employeeButtonRef.current;
      if (!current) return;
      setMenuStyle(menuStyleFor(current, open === 'group' ? 128 : 0));
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
      setOpen(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open === 'employee') searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (autoFocus) employeeButtonRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, groupId]);

  const selectGroup = (nextGroupId: string) => {
    setGroupId(nextGroupId);
    setOpen(null);
    setQuery('');
    if (!assigneeUserId) return;
    const user = getUserById(assigneeUserId);
    if (!user || !employeeBelongsToGroup(user, nextGroupId)) onChange('');
  };

  const selectEmployee = (userId: string) => {
    onChange(userId);
    setQuery('');
    setOpen(null);
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className={[
          'grid grid-cols-[auto_minmax(0,1fr)] rounded-md border bg-white',
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-brand-200',
        ].join(' ')}
      >
        <div className="relative border-r border-brand-200">
          <button
            ref={groupButtonRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open === 'group'}
            aria-label={`Group ${selectedGroup?.code ?? 'ALL'}`}
            title={selectedGroup?.name ?? 'All groups'}
            onClick={() => setOpen((current) => (current === 'group' ? null : 'group'))}
            className="flex h-10 min-w-[4.5rem] items-center justify-between gap-1.5 rounded-l-md px-2.5 text-sm font-medium text-brand-900 hover:bg-brand-50"
          >
            <span>{selectedGroup?.code ?? 'ALL'}</span>
            <ChevronDown
              size={16}
              className={[
                'shrink-0 text-brand-500 transition-transform',
                open === 'group' ? 'rotate-180' : '',
              ].join(' ')}
              aria-hidden
            />
          </button>
          {open === 'group'
            ? createPortal(
                <div
                  ref={menuRef}
                  style={menuStyle}
                  className="overflow-y-auto overscroll-contain rounded-md border border-brand-200 bg-white py-1 shadow-lg"
                >
                  <ul role="listbox" aria-label="Groups">
                    {options.map((option) => {
                      const selected = option.id === groupId;
                      return (
                        <li key={option.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            title={option.name}
                            onClick={() => selectGroup(option.id)}
                            className={[
                              'flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm font-medium text-brand-900',
                              selected ? 'bg-brand-50' : 'hover:bg-brand-50',
                            ].join(' ')}
                          >
                            <span>{option.code}</span>
                            {selected ? (
                              <Check size={15} className="shrink-0 text-brand-700" aria-hidden />
                            ) : (
                              <span className="w-[15px]" aria-hidden />
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

        <div className="relative min-w-0">
          <button
            ref={employeeButtonRef}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open === 'employee'}
            aria-controls={listId}
            aria-autocomplete="list"
            onClick={() =>
              setOpen((current) => (current === 'employee' ? null : 'employee'))
            }
            className="flex h-10 w-full items-center justify-between gap-2 rounded-r-md px-3 text-left text-sm hover:bg-brand-50"
          >
            <span
              className={[
                'min-w-0 truncate',
                assignee ? 'text-brand-900' : 'text-brand-400',
              ].join(' ')}
            >
              {assignee?.name ?? 'Select employee...'}
            </span>
            <ChevronDown
              size={16}
              className={[
                'shrink-0 text-brand-500 transition-transform',
                open === 'employee' ? 'rotate-180' : '',
              ].join(' ')}
              aria-hidden
            />
          </button>
          {open === 'employee'
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
                    id={searchId}
                    type="search"
                    value={query}
                    autoComplete="off"
                    placeholder="Search employee..."
                    aria-label="Search employee"
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
                        if (pick) selectEmployee(pick.id);
                      } else if (event.key === 'Escape') {
                        setOpen(null);
                      }
                    }}
                    className="w-full rounded-md border border-brand-200 bg-white py-1.5 pr-2 pl-8 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>
              <ul
                id={listId}
                role="listbox"
                aria-label="Employees"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
              >
                {results.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-brand-500">No employees found.</li>
                ) : (
                  results.map((user, index) => {
                    const selected = user.id === assigneeUserId;
                    const active = index === activeIndex;
                    return (
                      <li key={user.id} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectEmployee(user.id)}
                          className={[
                            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-brand-900',
                            active || selected ? 'bg-brand-50' : 'hover:bg-brand-50',
                          ].join(' ')}
                        >
                          <span className="min-w-0 truncate">{user.name}</span>
                          {selected ? (
                            <Check size={16} className="shrink-0 text-brand-700" aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
            : null}
        </div>
      </div>
    </div>
  );
}
