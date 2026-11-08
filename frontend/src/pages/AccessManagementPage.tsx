import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { AddApproverDialog } from '@/components/admin/AddApproverDialog';
import { RemoveApproverDialog } from '@/components/admin/RemoveApproverDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { paths } from '@/routes/paths';
import { grantAccess, listAccessAssignments, setAccessActive } from '@/services/accessApi';
import type { AccessAssignment } from '@/services/accessApi';
import { getGroupById, listActiveGroups } from '@/services/groupRepository';
import type { Group } from '@/types';
import { userHasRole } from '@/utils/permissions';

export function AccessManagementPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AccessAssignment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AccessAssignment | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const reload = () => {
    void listAccessAssignments().then((result) => {
      if (!result.ok) {
        setRows([]);
        setLoadError(result.error);
        return;
      }
      setRows(
        result.data
          .filter((row) => row.roleCode === 'ADMIN' && row.active)
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
      );
      setLoadError(null);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const groups = useMemo(() => directoryGroups(rows ?? []), [rows]);
  const visibleRows = useMemo(() => {
    const source = rows ?? [];
    const query = employeeQuery.trim().toLowerCase();
    return source.filter((row) => {
      if (groupId !== 'all' && row.primaryGroupId !== groupId) return false;
      if (!query) return true;
      return `${row.employeeName} ${row.employeeId}`.toLowerCase().includes(query);
    });
  }, [rows, employeeQuery, groupId]);

  if (!user || !userHasRole(user, 'admin')) {
    return <Navigate to={paths.requests} replace />;
  }

  const count = rows?.length ?? 0;
  const lastAdminLocked = count <= 1;

  const finishChange = (employeeId: string, title: string, description: string) => {
    if (employeeId === user.id) refreshUser();
    showToast({ tone: 'success', title, description });
    reload();
  };

  const addAdministrator = (employeeId: string) => {
    setAdding(true);
    setAddError(null);
    void grantAccess(employeeId, 'ADMIN').then((result) => {
      setAdding(false);
      if (!result.ok) {
        setAddError(result.error);
        return;
      }
      setAddOpen(false);
      finishChange(result.data.employeeId, 'Administrator added successfully', result.data.employeeName);
    });
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    void setAccessActive(removeTarget.employeeId, 'ADMIN', false).then((result) => {
      setRemoving(false);
      if (!result.ok) {
        setRemoveError(result.error);
        return;
      }
      const saved = result.data;
      setRemoveTarget(null);
      finishChange(saved.employeeId, 'Administrator removed successfully', saved.employeeName);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:gap-6 lg:p-6">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-900">Administrator Management</h1>
          <p className="mt-1 text-sm text-brand-600">
            {count} administrator{count === 1 ? '' : 's'}
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
          Add administrator
        </button>
      </div>

      {loadError ? (
        <p className="shrink-0 text-sm text-red-600" role="alert">
          {loadError}
        </p>
      ) : null}

      <section className="flex min-h-0 min-w-0 w-full max-h-full flex-col self-start overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="shrink-0 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-brand-600">Search</span>
              <input
                type="search"
                value={employeeQuery}
                onChange={(event) => setEmployeeQuery(event.target.value)}
                placeholder="Name or employee number…"
                className="w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-600">Group</span>
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="w-full rounded-md border border-brand-200 bg-white py-2 pr-10 pl-3 text-sm text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="all">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {rows === null ? (
          <p className="border-t border-brand-100 px-4 py-10 text-center text-sm text-brand-600">Loading administrators…</p>
        ) : visibleRows.length === 0 ? (
          <p className="border-t border-brand-100 px-4 py-10 text-center text-sm text-brand-600">
            {employeeQuery.trim() || groupId !== 'all'
              ? 'No administrators match these filters.'
              : 'No administrators yet.'}
          </p>
        ) : (
          <div className="min-h-0 overflow-y-auto border-t border-brand-100">
            <table className="min-w-full divide-y divide-brand-100 text-left text-sm">
              <thead className="sticky top-0 bg-white text-sm font-medium text-slate-500 [&_th]:font-medium">
                <tr>
                  <th className="px-4 py-3">Employee No.</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {visibleRows.map((row) => {
                  const locked = lastAdminLocked && row.active;
                  return (
                    <tr key={row.employeeId}>
                      <td className="px-4 py-3 text-brand-700">{row.employeeId}</td>
                      <td className="px-4 py-3 font-medium text-brand-900">{row.employeeName}</td>
                      <td className="px-4 py-3 text-brand-700">
                        {row.designation || 'Position unavailable'}
                      </td>
                      <td className="px-4 py-3 text-brand-700">{row.primaryGroupName || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={locked}
                          title={
                            locked
                              ? 'The last administrator cannot be removed.'
                              : 'Remove administrator'
                          }
                          aria-label={`Remove administrator ${row.employeeName}`}
                          onClick={() => {
                            if (locked) return;
                            setRemoveError(null);
                            setRemoveTarget(row);
                          }}
                          className="rounded-md p-1.5 text-brand-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-brand-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AddApproverDialog
        open={addOpen}
        groups={groups}
        initialGroupId={null}
        excludedEmployeeIds={(rows ?? []).map((row) => row.employeeId)}
        submitting={adding}
        error={addError}
        title="Add administrator"
        description="Grant an employee administrator access."
        submitLabel="Add administrator"
        onClose={() => {
          if (adding) return;
          setAddOpen(false);
        }}
        onSubmit={addAdministrator}
      />
      <RemoveApproverDialog
        employeeName={removeTarget?.employeeName ?? null}
        submitting={removing}
        error={removeError}
        title="Remove Administrator?"
        message={
          removeTarget ? (
            <>
              Are you sure you want to remove{' '}
              <span className="font-semibold">{removeTarget.employeeName}</span> as an
              administrator?
            </>
          ) : undefined
        }
        confirmLabel="Remove"
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
