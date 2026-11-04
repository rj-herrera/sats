import { GroupMultiSelect } from '@/components/template/GroupMultiSelect';
import { listActiveGroups, listGroups } from '@/services/groupRepository';
import type { FormTemplate, TemplateScope, User } from '@/types';
import { canCreateGenericTemplate } from '@/utils/templatePermissions';

export type TemplateAvailabilityMode = 'all' | 'selected';

interface TemplateBasicInformationProps {
  user: User;
  name: string;
  description: string;
  scope: TemplateScope;
  owningGroupId: string | null;
  availabilityMode: TemplateAvailabilityMode;
  groupSelectionDraft: string[];
  rememberedOwningGroupId: string | null;
  onChange: (
    patch: Partial<
      Pick<
        FormTemplate,
        'name' | 'description' | 'scope' | 'owningGroupId' | 'allowedGroupIds'
      > & {
        availabilityMode: TemplateAvailabilityMode;
        groupSelectionDraft: string[];
        rememberedOwningGroupId: string | null;
      }
    >,
  ) => void;
}

const fieldClass =
  'w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function TemplateBasicInformation({
  user,
  name,
  description,
  scope,
  owningGroupId,
  availabilityMode,
  groupSelectionDraft,
  rememberedOwningGroupId,
  onChange,
}: TemplateBasicInformationProps) {
  const canGeneric = canCreateGenericTemplate(user);
  const lockGroup = !canGeneric;
  const groups = canGeneric ? listGroups() : listActiveGroups();
  const owningMissing = scope === 'group' && !owningGroupId;
  const selectionMissing =
    scope === 'generic' &&
    availabilityMode === 'selected' &&
    groupSelectionDraft.length === 0;

  const selectScope = (next: TemplateScope) => {
    if (next === scope) return;
    if (next === 'group') {
      const groupId = rememberedOwningGroupId ?? owningGroupId ?? user.groupId;
      onChange({
        scope: 'group',
        owningGroupId: groupId,
        rememberedOwningGroupId: groupId,
        allowedGroupIds: groupId ? [groupId] : [],
      });
      return;
    }
    onChange({
      scope: 'generic',
      owningGroupId: null,
      allowedGroupIds: availabilityMode === 'selected' ? [...groupSelectionDraft] : [],
    });
  };

  const selectAvailability = (next: TemplateAvailabilityMode) => {
    if (next === availabilityMode) return;
    onChange({
      availabilityMode: next,
      allowedGroupIds: next === 'selected' ? [...groupSelectionDraft] : [],
    });
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
          className={fieldClass}
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
          className={fieldClass}
          placeholder="What is this template for?"
        />
      </label>

      {canGeneric ? (
        <div>
          <span id="template-scope-label" className="mb-1.5 block text-sm font-medium text-brand-800">
            Template scope
          </span>
          <div
            role="radiogroup"
            aria-labelledby="template-scope-label"
            className="grid grid-cols-2 rounded-md border border-brand-200 bg-brand-50 p-1"
          >
            <ScopeOption
              label="Group-specific"
              checked={scope === 'group'}
              onSelect={() => selectScope('group')}
            />
            <ScopeOption
              label="Generic / Shared"
              checked={scope === 'generic'}
              onSelect={() => selectScope('generic')}
            />
          </div>
          <p className="mt-2 text-xs text-brand-500">
            {scope === 'group'
              ? 'Template owned and managed within one organizational group.'
              : 'Admin-managed template that can be made available to multiple groups.'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-brand-100 bg-brand-50/50 px-3 py-2 text-sm text-brand-700">
          Group-specific template for <strong>{user.groupName}</strong>. Generic
          templates can only be created by Admin.
        </div>
      )}

      {scope === 'group' ? (
        <div>
          <span className="mb-1 block text-sm font-medium text-brand-800">
            Owning group *
          </span>
          {lockGroup ? (
            <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
              {user.groupName}
            </div>
          ) : (
            <select
              value={owningGroupId ?? ''}
              aria-invalid={owningMissing || undefined}
              onChange={(e) => {
                const groupId = e.target.value;
                onChange({
                  owningGroupId: groupId,
                  rememberedOwningGroupId: groupId,
                  allowedGroupIds: groupId ? [groupId] : [],
                });
              }}
              className={[
                fieldClass,
                owningMissing ? 'border-red-400 focus:ring-red-500/20' : '',
              ].join(' ')}
            >
              <option value="" disabled>
                Select owning group
              </option>
              {groups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                  disabled={group.status !== 'Active'}
                >
                  {group.name}
                  {group.status !== 'Active' ? ' (Inactive)' : ''}
                </option>
              ))}
            </select>
          )}
          {owningMissing ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              Owning group is required.
            </p>
          ) : null}
        </div>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-brand-800">Available to</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-brand-800">
              <input
                type="radio"
                name="template-availability"
                checked={availabilityMode === 'all'}
                onChange={() => selectAvailability('all')}
              />
              All groups
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-brand-800">
              <input
                type="radio"
                name="template-availability"
                checked={availabilityMode === 'selected'}
                onChange={() => selectAvailability('selected')}
              />
              Selected groups
            </label>
          </div>
          {availabilityMode === 'all' ? (
            <p className="mt-2 text-xs text-brand-500">
              This template will be available to every eligible group.
            </p>
          ) : (
            <div className="mt-3">
              <span className="mb-1 block text-sm font-medium text-brand-800">
                Select groups
              </span>
              <GroupMultiSelect
                groups={listGroups()}
                selectedIds={groupSelectionDraft}
                invalid={selectionMissing}
                onChange={(ids) =>
                  onChange({
                    groupSelectionDraft: ids,
                    allowedGroupIds: ids,
                  })
                }
              />
              {selectionMissing ? (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  Select at least one group.
                </p>
              ) : null}
            </div>
          )}
        </fieldset>
      )}
    </section>
  );
}

function ScopeOption({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={[
        'rounded px-3 py-1.5 text-sm font-medium',
        checked
          ? 'bg-white text-brand-900 shadow-sm'
          : 'text-brand-600 hover:text-brand-900',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
