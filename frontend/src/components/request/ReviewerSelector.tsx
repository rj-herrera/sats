import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { getGroupById, listActiveGroups } from '@/services/groupRepository';
import { formatReviewerRole } from '@/services/workflowService';
import type { User } from '@/types';

interface ReviewerSelectorProps {
  candidates: User[];
  /** Group to preselect on the first row. Used by group-scoped templates. */
  initialGroupId?: string;
  /** Shared templates list every active employee. Group templates list approvers. */
  audience?: 'employee' | 'approver';
  error?: string | null;
  onChange: (selectedIds: string[], unfinished: boolean) => void;
}

interface ReviewerRow {
  id: string;
  groupId: string;
  userId: string;
}

interface GroupOption {
  id: string;
  name: string;
  code: string;
}

interface OpenMenu {
  rowId: string;
  field: 'group' | 'employee';
}

function newRow(groupId = ''): ReviewerRow {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `reviewer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, groupId, userId: '' };
}

function belongsToGroup(user: User, groupId: string): boolean {
  if (user.groupId === groupId) return true;
  return user.groupIds?.includes(groupId) ?? false;
}

function rowIsUnfinished(row: ReviewerRow, rowCount: number): boolean {
  if (row.userId) return false;
  return row.groupId !== '' || rowCount > 1;
}

function groupLabel(group: GroupOption): string {
  return group.code.trim() || group.name;
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

export function ReviewerSelector({
  candidates,
  initialGroupId = '',
  audience = 'employee',
  error,
  onChange,
}: ReviewerSelectorProps) {
  const person = audience === 'approver' ? 'approver' : 'employee';
  const people = audience === 'approver' ? 'approvers' : 'employees';
  const groupListId = useId();
  const employeeListId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const scrollNewRow = useRef(false);
  const [maxHeight, setMaxHeight] = useState<number>();
  const [rows, setRows] = useState<ReviewerRow[]>(() => [newRow(initialGroupId)]);
  const [open, setOpen] = useState<OpenMenu | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [employeeQuery, setEmployeeQuery] = useState('');

  const groups = useMemo<GroupOption[]>(() => {
    const options = listActiveGroups().map((group) => ({
      id: group.id,
      name: group.name,
      code: group.code,
    }));
    if (initialGroupId && !options.some((group) => group.id === initialGroupId)) {
      const current = getGroupById(initialGroupId);
      if (current) {
        options.push({ id: current.id, name: current.name, code: current.code });
      }
    }
    return options.sort((a, b) => groupLabel(a).localeCompare(groupLabel(b)));
  }, [initialGroupId]);

  const chosenIds = useMemo(
    () => new Set(rows.map((row) => row.userId).filter((id) => id !== '')),
    [rows],
  );

  const publish = (next: ReviewerRow[]) => {
    setRows(next);
    const ids = [...new Set(next.map((row) => row.userId).filter((id) => id !== ''))];
    onChange(ids, next.some((row) => rowIsUnfinished(row, next.length)));
  };

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const scrollParent = section.parentElement?.closest('.overflow-y-auto');

    const update = () => {
      const sectionTop = section.getBoundingClientRect().top;
      const topInView = scrollParent
        ? sectionTop - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop
        : sectionTop;
      const visibleHeight = scrollParent?.getBoundingClientRect().height ?? window.innerHeight;
      const next = Math.max(Math.floor(visibleHeight - topInView - 8), 180);
      setMaxHeight((current) => (current === next ? current : next));
    };

    update();
    const observer = new ResizeObserver(update);
    if (scrollParent) observer.observe(scrollParent);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useLayoutEffect(() => {
    if (!scrollNewRow.current) return;
    scrollNewRow.current = false;
    const section = sectionRef.current;
    const list = rootRef.current;
    const last = list?.lastElementChild;
    const addButton = list?.nextElementSibling;
    if (!section || !last) return;
    const target = addButton instanceof HTMLElement ? addButton : last;
    const sectionRect = section.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (targetRect.bottom > sectionRect.bottom) {
      section.scrollTop += targetRect.bottom - sectionRect.bottom + 8;
    }
  }, [rows]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const anchor = anchorRef.current;
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
      setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openMenu = (rowId: string, field: OpenMenu['field'], anchor: HTMLButtonElement) => {
    const same = open?.rowId === rowId && open.field === field;
    if (same) {
      setOpen(null);
      return;
    }
    anchorRef.current = anchor;
    setEmployeeQuery('');
    setOpen({ rowId, field });
  };

  const selectGroup = (rowId: string, groupId: string) => {
    publish(
      rows.map((row) => {
        if (row.id !== rowId) return row;
        const stillInGroup =
          row.userId !== '' &&
          candidates.some((user) => user.id === row.userId && belongsToGroup(user, groupId));
        return { ...row, groupId, userId: stillInGroup ? row.userId : '' };
      }),
    );
    setOpen(null);
  };

  const selectEmployee = (rowId: string, userId: string) => {
    publish(rows.map((row) => (row.id === rowId ? { ...row, userId } : row)));
    setOpen(null);
  };

  const removeRow = (rowId: string) => {
    if (rows.length === 1) {
      publish([{ ...rows[0], groupId: initialGroupId, userId: '' }]);
      setOpen(null);
      return;
    }
    publish(rows.filter((row) => row.id !== rowId));
    setOpen(null);
  };

  const addRow = () => {
    scrollNewRow.current = true;
    publish([...rows, newRow()]);
  };

  const canAdd = rows.every((row) => row.userId !== '');
  const openRow = open ? rows.find((row) => row.id === open.rowId) : undefined;

  const employeeChoices = useMemo(() => {
    if (!openRow?.groupId) return [];
    const query = employeeQuery.trim().toLowerCase();
    return candidates
      .filter((user) => belongsToGroup(user, openRow.groupId))
      .filter((user) => user.id === openRow.userId || !chosenIds.has(user.id))
      .filter((user) => (query ? user.name.toLowerCase().includes(query) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [candidates, chosenIds, employeeQuery, openRow]);

  return (
    <section
      ref={sectionRef}
      style={maxHeight ? { maxHeight } : undefined}
      className="flex flex-col overflow-y-auto overscroll-contain rounded-lg border border-brand-100 bg-white p-5 shadow-sm"
    >
      <h2 className="shrink-0 text-base font-semibold text-brand-900">Select Reviewers / Approvers</h2>
      <p className="mt-1 shrink-0 text-sm text-brand-600">
        Choose a group, then an {person} in that group.
      </p>

      <div ref={rootRef} className="mt-4 space-y-3">
        {rows.map((row, index) => {
          const group = groups.find((item) => item.id === row.groupId);
          const employee = candidates.find((user) => user.id === row.userId);
          const groupOpen = open?.rowId === row.id && open.field === 'group';
          const employeeOpen = open?.rowId === row.id && open.field === 'employee';
          const menuOpen = groupOpen || employeeOpen;
          return (
            <div key={row.id} className="flex items-center gap-2">
              <div
                className={[
                  'flex min-w-0 flex-1 overflow-hidden rounded-md border bg-white',
                  menuOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-brand-200',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-label={group ? group.name : 'Select group'}
                  title={group?.name}
                  aria-haspopup="listbox"
                  aria-expanded={groupOpen}
                  aria-controls={groupOpen ? groupListId : undefined}
                  onClick={(event) => openMenu(row.id, 'group', event.currentTarget)}
                  className={[
                    'flex w-1/4 shrink-0 items-center justify-between gap-1 border-r px-2 py-2 text-left text-sm',
                    menuOpen ? 'border-brand-500' : 'border-brand-200',
                    group ? 'text-brand-900' : 'text-brand-400',
                  ].join(' ')}
                >
                  <span className="min-w-0 truncate">{group ? groupLabel(group) : 'Group'}</span>
                  <ChevronDown
                    size={16}
                    className={[
                      'shrink-0 text-brand-500 transition-transform',
                      groupOpen ? 'rotate-180' : '',
                    ].join(' ')}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={employeeOpen}
                  aria-controls={employeeOpen ? employeeListId : undefined}
                  disabled={!row.groupId}
                  onClick={(event) => {
                    if (!row.groupId) return;
                    openMenu(row.id, 'employee', event.currentTarget);
                  }}
                  className={[
                    'flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                    !row.groupId ? 'cursor-not-allowed bg-brand-50 text-brand-400' : '',
                    employee ? 'text-brand-900' : 'text-brand-400',
                  ].join(' ')}
                >
                  <span className="min-w-0 truncate">
                    {employee?.name ?? (row.groupId ? 'Select employee' : 'Select a group first')}
                  </span>
                  <ChevronDown
                    size={16}
                    className={[
                      'shrink-0 text-brand-500 transition-transform',
                      employeeOpen ? 'rotate-180' : '',
                    ].join(' ')}
                    aria-hidden
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="shrink-0 rounded p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-800"
                aria-label={`Remove reviewer ${index + 1}`}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        disabled={!canAdd}
        className="mt-3 inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus size={16} aria-hidden />
        Add Approver/Reviewer
      </button>

      {error ? (
        <p className="mt-3 shrink-0 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {open && openRow
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="overflow-y-auto overscroll-contain rounded-md border border-brand-200 bg-white shadow-lg"
            >
              {open.field === 'employee' ? (
                <div className="sticky top-0 border-b border-brand-100 bg-white p-2">
                  <input
                    type="search"
                    value={employeeQuery}
                    autoFocus
                    placeholder="Search employee..."
                    aria-label="Search employee"
                    onChange={(event) => setEmployeeQuery(event.target.value)}
                    className="w-full rounded-md border border-brand-200 px-2.5 py-1.5 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              ) : null}
              <ul
                id={open.field === 'group' ? groupListId : employeeListId}
                role="listbox"
                aria-label={open.field === 'group' ? 'Groups' : 'Employees'}
                className="py-1"
              >
                {open.field === 'group'
                  ? groups.map((group) => {
                      const selected = group.id === openRow.groupId;
                      return (
                        <li key={group.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            onClick={() => selectGroup(openRow.id, group.id)}
                            className={[
                              'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-brand-900',
                              selected ? 'bg-brand-50' : 'hover:bg-brand-50',
                            ].join(' ')}
                          >
                            <span className="min-w-0" title={group.name}>
                              {groupLabel(group)}
                            </span>
                            {selected ? (
                              <Check size={15} className="shrink-0 text-brand-700" aria-hidden />
                            ) : (
                              <span className="w-[15px] shrink-0" aria-hidden />
                            )}
                          </button>
                        </li>
                      );
                    })
                  : employeeChoices.length === 0
                    ? (
                        <li className="px-3 py-3 text-sm text-brand-500">
                          {employeeQuery.trim()
                            ? `No ${people} match that name.`
                            : `No ${people} in this group.`}
                        </li>
                      )
                    : employeeChoices.map((user) => {
                        const selected = user.id === openRow.userId;
                        return (
                          <li key={user.id} role="option" aria-selected={selected}>
                            <button
                              type="button"
                              onClick={() => selectEmployee(openRow.id, user.id)}
                              className={[
                                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left',
                                selected ? 'bg-brand-50' : 'hover:bg-brand-50',
                              ].join(' ')}
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-brand-900">
                                  {user.name}
                                </span>
                                <span className="block text-xs text-brand-500">
                                  {user.designation?.trim() || formatReviewerRole(user)}
                                </span>
                              </span>
                              {selected ? (
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
    </section>
  );
}
