import { listActiveGroups, listGroups } from '@/services/groupRepository';
import type { FormTemplate, TemplateScope, User } from '@/types';
import { canCreateGenericTemplate } from '@/utils/templatePermissions';

interface TemplateBasicInformationProps {
  user: User;
  name: string;
  description: string;
  scope: TemplateScope;
  owningGroupId: string | null;
  allowedGroupIds: string[];
  onChange: (
    patch: Partial<
      Pick<
        FormTemplate,
        'name' | 'description' | 'scope' | 'owningGroupId' | 'allowedGroupIds'
      >
    >,
  ) => void;
}

export function TemplateBasicInformation({
  user,
  name,
  description,
  scope,
  owningGroupId,
  allowedGroupIds,
  onChange,
}: TemplateBasicInformationProps) {
  const canGeneric = canCreateGenericTemplate(user);
  const lockGroup = !canGeneric;

  const toggleAllowedGroup = (groupId: string) => {
    if (allowedGroupIds.includes(groupId)) {
      onChange({
        allowedGroupIds: allowedGroupIds.filter((id) => id !== groupId),
      });
    } else {
      onChange({ allowedGroupIds: [...allowedGroupIds, groupId] });
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-brand-900">Basic information</h2>
        <p className="mt-1 text-sm text-brand-500">
          Name, description, and who can use this template.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-brand-800">
          Template name *
        </span>
        <input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="e.g. Overtime Request"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-brand-800">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="What is this template for?"
        />
      </label>

      {canGeneric ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-brand-800">
            Template scope
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex gap-3 rounded-lg border border-brand-100 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
              <input
                type="radio"
                name="template-scope"
                checked={scope === 'group'}
                onChange={() =>
                  onChange({
                    scope: 'group',
                    owningGroupId: owningGroupId ?? user.groupId,
                    allowedGroupIds: owningGroupId
                      ? [owningGroupId]
                      : [user.groupId],
                  })
                }
              />
              <span className="text-sm">
                <span className="font-medium text-brand-900">Group-specific</span>
                <span className="mt-0.5 block text-xs text-brand-500">
                  Owned by one group
                </span>
              </span>
            </label>
            <label className="flex gap-3 rounded-lg border border-brand-100 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
              <input
                type="radio"
                name="template-scope"
                checked={scope === 'generic'}
                onChange={() =>
                  onChange({
                    scope: 'generic',
                    owningGroupId: null,
                    allowedGroupIds: [],
                  })
                }
              />
              <span className="text-sm">
                <span className="font-medium text-brand-900">Generic / Shared</span>
                <span className="mt-0.5 block text-xs text-brand-500">
                  Admin-managed, multi-group
                </span>
              </span>
            </label>
          </div>
        </fieldset>
      ) : (
        <div className="rounded-md border border-brand-100 bg-brand-50/50 px-3 py-2 text-sm text-brand-700">
          Group-specific template for <strong>{user.groupName}</strong>. Generic
          templates can only be created by Admin.
        </div>
      )}

      {scope === 'group' ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-brand-800">
            Owning group
          </span>
          <select
            value={owningGroupId ?? ''}
            disabled={lockGroup}
            onChange={(e) =>
              onChange({
                owningGroupId: e.target.value,
                allowedGroupIds: [e.target.value],
              })
            }
            className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm disabled:bg-brand-50"
          >
            {(canGeneric ? listGroups() : listActiveGroups()).map((group) => (
              <option key={group.id} value={group.id} disabled={group.status !== 'Active'}>
                {group.name}
                {group.status !== 'Active' ? ' (Inactive)' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-brand-800">
            Available groups
          </legend>
          <p className="mb-2 text-xs text-brand-500">
            Leave all unchecked to make this template available to every group.
          </p>
          <ul className="space-y-2">
            {listGroups().map((group) => (
              <li key={group.id}>
                <label className="flex items-center gap-2 text-sm text-brand-800">
                  <input
                    type="checkbox"
                    checked={allowedGroupIds.includes(group.id)}
                    onChange={() => toggleAllowedGroup(group.id)}
                    disabled={group.status !== 'Active'}
                    className="rounded border-brand-300"
                  />
                  {group.name}
                  {group.status !== 'Active' ? ' (Inactive)' : ''}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </section>
  );
}
