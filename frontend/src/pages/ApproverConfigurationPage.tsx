import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { AddApproverDialog } from '@/components/admin/AddApproverDialog';
import { RemoveApproverDialog } from '@/components/admin/RemoveApproverDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { paths } from '@/routes/paths';
import { grantApprover, listApprovers, setApproverActive } from '@/services/accessApi';
import type { AccessAssignment } from '@/services/accessApi';
import { getGroupById, listActiveGroups } from '@/services/groupRepository';
import type { Group } from '@/types';
import { userHasRole } from '@/utils/permissions';

export function ApproverConfigurationPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AccessAssignment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AccessAssignment | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const reload = () => {
    void listApprovers().then((result) => {
      if (!result.ok) {
        setRows([]);
        setLoadError(result.error);
        return;
      }
      setRows(
        result.data
          .filter((row) => row.roleCode === 'APPROVER' && row.active)
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
      );
      setLoadError(null);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const groups = useMemo(() => directoryGroups(rows ?? []), [rows]);
  const counts = useMemo(() => countByGroup(rows ?? []), [rows]);

  useEffect(() => {
    if (groups.length === 0) return;
    if (groups.some((group) => group.id === selectedGroupId)) return;
    setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  const visibleGroups = useMemo(() => {
    const query = groupQuery.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => `${group.name} ${group.code}`.toLowerCase().includes(query));
  }, [groups, groupQuery]);

  const scopedRows = useMemo(() => {
    const source = rows ?? [];
    if (!selectedGroupId) return [];
    return source.filter((row) => row.primaryGroupId === selectedGroupId);
  }, [rows, selectedGroupId]);

  const visibleRows = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return scopedRows;
    return scopedRows.filter((row) =>
      `${row.employeeName} ${row.employeeId}`.toLowerCase().includes(query),
    );
  }, [scopedRows, employeeQuery]);

  if (!userHasRole(user, 'admin')) {
    return <Navigate to={paths.requests} replace />;
  }

  const finishChange = (employeeId: string, title: string, description: string) => {
    if (employeeId === user.id) refreshUser();
    showToast({ tone: 'success', title, description });
    reload();
  };

  const addApprover = (employeeId: string) => {
    setAdding(true);
    setAddError(null);
    void grantApprover(employeeId).then((result) => {
      setAdding(false);
      if (!result.ok) {
        setAddError(result.error);
        return;
      }
      setAddOpen(false);
      finishChange(result.data.employeeId, 'Approver added successfully', result.data.employeeName);
    });
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    void setApproverActive(removeTarget.employeeId, false).then((result) => {
      setRemoving(false);
      if (!result.ok) {
        setRemoveError(result.error);
        return;
      }
      const saved = result.data;
      setRemoveTarget(null);
      finishChange(saved.employeeId, 'Approver removed successfully', saved.employeeName);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:gap-6 lg:p-6">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-brand-900">Approver Configuration</h1>
            <p className="mt-1 text-sm text-brand-600">
              {rows?.length ?? 0} approver{(rows?.length ?? 0) === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Plus size={16} />
            Add Approver
          </button>
        </div>

        {loadError ? (
          <p className="shrink-0 text-sm text-red-600" role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm lg:w-[28%] lg:max-w-xs lg:flex-none">
            <div className="shrink-0 border-b border-brand-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-brand-900">Groups</h2>
              <label className="relative mt-3 block">
                <Search
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-brand-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.target.value)}
                  placeholder="Search group..."
                  aria-label="Search group"
                  className="w-full rounded-md border border-brand-200 py-1.5 pr-2 pl-8 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto py-1">
              {groups.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-brand-500">No groups available.</li>
              ) : visibleGroups.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-brand-500">
                  No groups match this search.
                </li>
              ) : (
                visibleGroups.map((group) => (
                  <GroupOption
                    key={group.id}
                    label={group.name}
                    count={counts.get(group.id) ?? 0}
                    selected={selectedGroupId === group.id}
                    onSelect={() => {
                      setSelectedGroupId(group.id);
                      setEmployeeQuery('');
                    }}
                  />
                ))
              )}
            </ul>
          </section>

          <section className="flex min-h-0 min-w-0 w-full max-h-full flex-col self-start overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm lg:flex-1">
            <div className="shrink-0 border-b border-brand-100 p-4">
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-600">Search</span>
                  <input
                    type="search"
                    value={employeeQuery}
                    onChange={(event) => setEmployeeQuery(event.target.value)}
                    placeholder="Name or employee number…"
                    className="w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
              </div>
            </div>

            {rows === null ? (
              <p className="px-4 py-10 text-center text-sm text-brand-600">Loading approvers…</p>
            ) : visibleRows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-brand-600">
                {employeeQuery.trim()
                  ? 'No employees match this search.'
                  : 'This group has no designated approvers.'}
              </p>
            ) : (
              <div className="min-h-0 overflow-y-auto">
                <table className="min-w-full divide-y divide-brand-100 text-left text-sm">
                  <thead className="sticky top-0 bg-white text-sm font-medium text-slate-500 [&_th]:font-medium">
                    <tr>
                      <th className="px-4 py-3">Employee No.</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100">
                    {visibleRows.map((row) => (
                      <tr key={row.employeeId}>
                        <td className="px-4 py-3 text-brand-700">{row.employeeId}</td>
                        <td className="px-4 py-3 font-medium text-brand-900">{row.employeeName}</td>
                        <td className="px-4 py-3 text-brand-700">
                          {row.designation || 'Position unavailable'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            title="Remove approver"
                            aria-label={`Remove approver ${row.employeeName}`}
                            onClick={() => {
                              setRemoveError(null);
                              setRemoveTarget(row);
                            }}
                            className="rounded-md p-1.5 text-brand-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

      <AddApproverDialog
        open={addOpen}
        groups={groups}
        initialGroupId={selectedGroupId || null}
        excludedEmployeeIds={(rows ?? []).map((row) => row.employeeId)}
        submitting={adding}
        error={addError}
        onClose={() => {
          if (adding) return;
          setAddOpen(false);
        }}
        onSubmit={addApprover}
      />
      <RemoveApproverDialog
        employeeName={removeTarget?.employeeName ?? null}
        submitting={removing}
        error={removeError}
        onCancel={() => {
          if (removing) return;
          setRemoveTarget(null);
          setRemoveError(null);
        }}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function directoryGroups(rows: AccessAssignment[]): Group[] {
  const groups = [...listActiveGroups()];
  const seen = new Set(groups.map((group) => group.id));
  for (const row of rows) {
    if (!row.primaryGroupId || seen.has(row.primaryGroupId)) continue;
    const group = getGroupById(row.primaryGroupId);
    if (!group) continue;
    groups.push(group);
    seen.add(group.id);
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}

function countByGroup(rows: AccessAssignment[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.primaryGroupId) continue;
    counts.set(row.primaryGroupId, (counts.get(row.primaryGroupId) ?? 0) + 1);
  }
  return counts;
}

function GroupOption({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'flex w-full items-center justify-between gap-3 border-l-2 px-4 py-2.5 text-left text-sm',
          selected
            ? 'border-l-brand-700 bg-sky-50 font-medium text-brand-900'
            : 'border-l-transparent text-brand-800 hover:bg-brand-50',
        ].join(' ')}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-xs text-brand-500">{count}</span>
      </button>
    </li>
  );
}
