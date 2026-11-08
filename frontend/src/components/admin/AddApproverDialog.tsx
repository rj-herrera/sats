import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { listAssignableUsers } from '@/services/userRepository';
import type { Group, User } from '@/types';
import { getUserInitials } from '@/utils/userDisplay';

interface AddApproverDialogProps {
  open: boolean;
  groups: Group[];
  initialGroupId: string | null;
  excludedEmployeeIds: string[];
  submitting: boolean;
  error: string | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (employeeId: string) => void;
}

export function AddApproverDialog({
  open,
  groups,
  initialGroupId,
  excludedEmployeeIds,
  submitting,
  error,
  title = 'Add Approver',
  description = 'Designate an employee as an approver for a specific group.',
  submitLabel = 'Add Approver',
  onClose,
  onSubmit,
}: AddApproverDialogProps) {
  const titleId = useId();
  const [groupId, setGroupId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGroupId(initialGroupId ?? '');
    setEmployeeId('');
    setGroupQuery('');
    setEmployeeQuery('');
    setGroupOpen(false);
    setEmployeeOpen(false);
  }, [open, initialGroupId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedEmployee = employeeId
    ? listAssignableUsers().find((person) => person.id === employeeId)
    : undefined;

  const groupResults = useMemo(() => {
    const query = groupQuery.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => {
      const haystack = `${group.name} ${group.code}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [groups, groupQuery]);

  const employeeResults = useMemo(() => {
    if (!groupId) return [];
    const excluded = new Set(excludedEmployeeIds);
    const people = listAssignableUsers().filter(
      (person) => person.groupId === groupId && !excluded.has(person.id),
    );
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) => {
      const haystack = `${person.name} ${person.designation ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [groupId, employeeQuery, excludedEmployeeIds]);

  if (!open) return null;

  const selectGroup = (nextGroupId: string) => {
    setGroupId(nextGroupId);
    setEmployeeId('');
    setEmployeeQuery('');
    setGroupOpen(false);
    setGroupQuery('');
  };

  const selectEmployee = (person: User) => {
    setEmployeeId(person.id);
    setEmployeeOpen(false);
    setEmployeeQuery('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        disabled={submitting}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-lg border border-brand-100 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-brand-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-brand-600">{description}</p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded p-1 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="relative">
            <span className="mb-1.5 block text-sm font-medium text-brand-800">Group</span>
            <button
              type="button"
              disabled={submitting}
              aria-haspopup="listbox"
              aria-expanded={groupOpen}
              onClick={() => {
                setGroupOpen((current) => !current);
                setEmployeeOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-brand-200 bg-white px-3 text-left text-sm hover:bg-brand-50 disabled:opacity-50"
            >
              <span className={selectedGroup ? 'truncate text-brand-900' : 'text-brand-400'}>
                {selectedGroup?.name ?? 'Select a group'}
              </span>
              <ChevronDown size={16} className="shrink-0 text-brand-500" aria-hidden />
            </button>
            {groupOpen ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-brand-200 bg-white shadow-lg">
                <div className="border-b border-brand-100 p-2">
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-brand-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={groupQuery}
                      autoFocus
                      placeholder="Search group..."
                      aria-label="Search group"
                      onChange={(event) => setGroupQuery(event.target.value)}
                      className="w-full rounded-md border border-brand-200 py-1.5 pr-2 pl-8 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
                <ul role="listbox" aria-label="Groups" className="max-h-48 overflow-y-auto py-1">
                  {groupResults.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-brand-500">No groups match this search.</li>
                  ) : (
                    groupResults.map((group) => (
                      <li key={group.id}>
                        <button
                          type="button"
                          onClick={() => selectGroup(group.id)}
                          className={[
                            'flex w-full px-3 py-2 text-left text-sm text-brand-900',
                            group.id === groupId ? 'bg-brand-50' : 'hover:bg-brand-50',
                          ].join(' ')}
                        >
                          {group.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <span className="mb-1.5 block text-sm font-medium text-brand-800">Employee</span>
            <button
              type="button"
              disabled={submitting || !groupId}
              aria-haspopup="listbox"
              aria-expanded={employeeOpen}
              onClick={() => {
                if (!groupId) return;
                setEmployeeOpen((current) => !current);
                setGroupOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-brand-200 bg-white px-3 text-left text-sm hover:bg-brand-50 disabled:cursor-not-allowed disabled:bg-brand-50 disabled:opacity-70"
            >
              <span className={selectedEmployee ? 'truncate text-brand-900' : 'text-brand-400'}>
                {selectedEmployee?.name ??
                  (groupId ? 'Select an employee' : 'Select a group first')}
              </span>
              <ChevronDown size={16} className="shrink-0 text-brand-500" aria-hidden />
            </button>
            {employeeOpen ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-brand-200 bg-white shadow-lg">
                <div className="border-b border-brand-100 p-2">
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-brand-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={employeeQuery}
                      autoFocus
                      placeholder="Search employee..."
                      aria-label="Search employee"
                      onChange={(event) => setEmployeeQuery(event.target.value)}
                      className="w-full rounded-md border border-brand-200 py-1.5 pr-2 pl-8 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
                <ul role="listbox" aria-label="Employees" className="max-h-52 overflow-y-auto py-1">
                  {employeeResults.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-brand-500">
                      {employeeQuery.trim()
                        ? 'No employees match this search.'
                        : 'No eligible employees in this group.'}
                    </li>
                  ) : (
                    employeeResults.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => selectEmployee(person)}
                          className={[
                            'flex w-full items-center gap-3 px-3 py-2 text-left',
                            person.id === employeeId ? 'bg-brand-50' : 'hover:bg-brand-50',
                          ].join(' ')}
                        >
                          <Initials name={person.name} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-brand-900">
                              {person.name}
                            </span>
                            <span className="block truncate text-xs text-brand-500">
                              {person.designation?.trim() || 'Position unavailable'}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !groupId || !employeeId}
            onClick={() => onSubmit(employeeId)}
            className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Adding…' : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
      {getUserInitials(name)}
    </span>
  );
}
