import { useEffect, useState } from 'react';
import { AssignedApproverSelect } from '@/components/template/AssignedApproverSelect';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { AccessAssignment, AccessRoleCode } from '@/services/accessApi';
import type { ApiResult } from '@/services/requestApi';
import { getGroupName } from '@/utils/groupDisplay';

interface AssignmentPanelProps {
  title: string;
  description: string;
  addLabel: string;
  emptyLabel: string;
  roleCode: AccessRoleCode;
  showManagedGroup?: boolean;
  load: () => Promise<ApiResult<AccessAssignment[]>>;
  grant: (employeeId: string) => Promise<ApiResult<AccessAssignment>>;
  setActive: (employeeId: string, active: boolean) => Promise<ApiResult<AccessAssignment>>;
  syncGroup?: (employeeId: string) => Promise<ApiResult<AccessAssignment>>;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium',
        active
          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
          : 'border-slate-300 bg-slate-200 text-slate-700',
      ].join(' ')}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function AssignmentPanel({
  title,
  description,
  addLabel,
  emptyLabel,
  roleCode,
  showManagedGroup = false,
  load,
  grant,
  setActive,
  syncGroup,
}: AssignmentPanelProps) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AccessAssignment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = () => {
    setRows(null);
    setLoadError(null);
    void load().then((result) => {
      if (!result.ok) {
        setRows([]);
        setLoadError(result.error);
        return;
      }
      const mine = result.data
        .filter((row) => row.roleCode === roleCode)
        .sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          return a.employeeName.localeCompare(b.employeeName);
        });
      setRows(mine);
      setLoadError(null);
    });
  };

  useEffect(() => {
    reload();
    // The loader identity changes with each page render. Load once per panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleCode]);

  const finish = (result: ApiResult<AccessAssignment>, successTitle: string, successDescription: string) => {
    setBusyId(null);
    setAdding(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setActionError(null);
    if (result.data.employeeId === user.id) refreshUser();
    showToast({ tone: 'success', title: successTitle, description: successDescription });
    reload();
  };

  const addEmployee = () => {
    if (!employeeId || adding) return;
    setAdding(true);
    setActionError(null);
    void grant(employeeId).then((result) => {
      if (result.ok) setEmployeeId('');
      finish(
        result,
        'Employee added',
        result.ok ? result.data.employeeName : '',
      );
    });
  };

  const changeActive = (row: AccessAssignment, active: boolean) => {
    setBusyId(row.employeeId);
    setActionError(null);
    void setActive(row.employeeId, active).then((result) => {
      finish(
        result,
        active ? 'Assignment activated' : 'Assignment deactivated',
        result.ok ? result.data.employeeName : '',
      );
    });
  };

  const updateGroup = (row: AccessAssignment) => {
    if (!syncGroup) return;
    setBusyId(row.employeeId);
    setActionError(null);
    void syncGroup(row.employeeId).then((result) => {
      finish(result, 'Template group updated', result.ok ? result.data.employeeName : '');
    });
  };

  const activeAdmins = rows?.filter((row) => row.active).length ?? 0;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-brand-900">{title}</h2>
        <p className="mt-1 text-sm text-brand-600">{description}</p>
      </div>

      <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <AssignedApproverSelect assigneeUserId={employeeId} onChange={setEmployeeId} />
          </div>
          <button
            type="button"
            disabled={!employeeId || adding}
            onClick={addEmployee}
            className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? 'Adding…' : addLabel}
          </button>
        </div>
      </div>

      {actionError ? (
        <p className="text-sm text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}
      {loadError ? (
        <p className="text-sm text-red-600" role="alert">
          {loadError}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-brand-600">Loading assignments…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-10 text-center text-sm text-brand-600">
          {emptyLabel}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-brand-100 text-left text-sm">
              <thead className="bg-brand-50/80 text-sm font-medium text-slate-500 [&_th]:font-medium">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Group</th>
                  {showManagedGroup ? <th className="px-4 py-3">Templates for</th> : null}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {rows.map((row) => {
                  const lastAdmin = roleCode === 'ADMIN' && row.active && activeAdmins <= 1;
                  const groupDrift =
                    showManagedGroup &&
                    row.active &&
                    row.primaryGroupId !== null &&
                    row.groupId !== row.primaryGroupId;
                  return (
                    <tr key={row.employeeId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-900">{row.employeeName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.designation || 'Position unavailable'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-brand-700">{row.primaryGroupName || '—'}</td>
                      {showManagedGroup ? (
                        <td className="px-4 py-3 text-brand-700">
                          <p>{getGroupName(row.groupId)}</p>
                          {groupDrift ? (
                            <button
                              type="button"
                              disabled={busyId === row.employeeId}
                              onClick={() => updateGroup(row)}
                              className="mt-1 text-xs font-medium text-brand-700 underline hover:text-brand-900 disabled:opacity-50"
                            >
                              Use current group
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <StatusPill active={row.active} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busyId === row.employeeId || lastAdmin}
                          title={lastAdmin ? 'The last administrator cannot be removed.' : undefined}
                          onClick={() => changeActive(row, !row.active)}
                          className="rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {row.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.map((row) => {
              const lastAdmin = roleCode === 'ADMIN' && row.active && activeAdmins <= 1;
              return (
                <li key={row.employeeId} className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-900">{row.employeeName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.designation || 'Position unavailable'}
                      </p>
                    </div>
                    <StatusPill active={row.active} />
                  </div>
                  <p className="mt-2 text-xs text-brand-600">{row.primaryGroupName || '—'}</p>
                  <button
                    type="button"
                    disabled={busyId === row.employeeId || lastAdmin}
                    onClick={() => changeActive(row, !row.active)}
                    className="mt-3 rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-800 disabled:opacity-50"
                  >
                    {row.active ? 'Deactivate' : 'Activate'}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
