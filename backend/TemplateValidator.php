<?php

declare(strict_types=1);

namespace App;

use App\Models\EmployeeModel;
use App\Models\GroupModel;

final class TemplateValidator
{
    private const FIELD_TYPES = [
        'text',
        'textarea',
        'number',
        'currency_php',
        'currency_usd',
        'currency_jpy',
        'url',
        'date',
        'select',
        'radio',
        'checkbox',
        'file',
    ];

    public function __construct(
        private readonly GroupModel $groups,
        private readonly EmployeeModel $employees,
    ) {
    }

    /**
     * @param array<string, mixed> $input
     * @return array{
     *   name: string,
     *   description: string,
     *   scope: string,
     *   owningGroupId: string|null,
     *   allowedGroupIds: list<string>,
     *   status: string,
     *   fields: list<array<string, mixed>>,
     *   workflow: array<string, mixed>,
     *   workflowType: string
     * }
     */
    public function normalize(array $input): array
    {
        $errors = [];
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            $errors[] = 'Template name is required.';
        } elseif (strlen($name) > 200) {
            $errors[] = 'Template name must be 200 characters or fewer.';
        }

        $description = trim((string) ($input['description'] ?? ''));
        $scope = $input['scope'] ?? '';
        if ($scope !== 'generic' && $scope !== 'group') {
            $errors[] = 'Scope must be generic or group.';
            $scope = 'group';
        }

        $status = $input['status'] ?? 'Inactive';
        if ($status !== 'Active' && $status !== 'Inactive') {
            $errors[] = 'Status must be Active or Inactive.';
            $status = 'Inactive';
        }

        $owningGroupId = $this->optionalId($input['owningGroupId'] ?? null, 'Owning group', $errors);
        $allowedGroupIds = $this->idList($input['allowedGroupIds'] ?? [], 'Available group', $errors);

        if ($scope === 'generic') {
            $owningGroupId = null;
        } elseif ($owningGroupId === null) {
            $errors[] = 'Group-specific templates require an owning group.';
        } elseif ($this->groups->find((int) $owningGroupId) === null) {
            $errors[] = 'Owning group does not exist.';
        } elseif (!in_array($owningGroupId, $allowedGroupIds, true)) {
            $allowedGroupIds[] = $owningGroupId;
        }

        foreach ($allowedGroupIds as $groupId) {
            if ($this->groups->find((int) $groupId) === null) {
                $errors[] = 'Available group ' . $groupId . ' does not exist.';
            }
        }

        $fields = $this->fields($input['fields'] ?? [], $status === 'Active', $errors);
        $workflow = $this->workflow($input['workflow'] ?? null, $status === 'Active', $errors);

        if ($status === 'Active') {
            if ($description === '') {
                $errors[] = 'Template description is required before activation.';
            }
            if ($fields === []) {
                $errors[] = 'Add at least one form field before activating.';
            }
        }

        if ($errors !== []) {
            throw new HttpException('Template is not valid.', 400, ['errors' => array_values(array_unique($errors))]);
        }

        return [
            'name' => $name,
            'description' => $description,
            'scope' => $scope,
            'owningGroupId' => $owningGroupId,
            'allowedGroupIds' => $allowedGroupIds,
            'status' => $status,
            'fields' => $fields,
            'workflow' => $workflow['workflow'],
            'workflowType' => $workflow['type'],
        ];
    }

    /**
     * @param list<string> $errors
     */
    private function optionalId(mixed $value, string $label, array &$errors): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_string($value) && !is_int($value)) {
            $errors[] = $label . ' must be a number.';
            return null;
        }
        $id = (string) $value;
        if (preg_match('/^\d+$/', $id) !== 1) {
            $errors[] = $label . ' must be a number.';
            return null;
        }

        return $id;
    }

    /**
     * @param list<string> $errors
     * @return list<string>
     */
    private function idList(mixed $value, string $label, array &$errors): array
    {
        if ($value === null) {
            return [];
        }
        if (!is_array($value)) {
            $errors[] = $label . 's must be a list.';
            return [];
        }

        $ids = [];
        foreach ($value as $item) {
            $id = $this->optionalId($item, $label, $errors);
            if ($id !== null && !in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    /**
     * @param list<string> $errors
     * @return list<array<string, mixed>>
     */
    private function fields(mixed $value, bool $activating, array &$errors): array
    {
        if (!is_array($value)) {
            $errors[] = 'Fields must be a list.';
            return [];
        }

        $fields = [];
        $seen = [];
        foreach ($value as $index => $raw) {
            if (!is_array($raw)) {
                $errors[] = 'Field ' . ($index + 1) . ' must be an object.';
                continue;
            }
            $id = trim((string) ($raw['id'] ?? ''));
            $label = trim((string) ($raw['label'] ?? ''));
            $type = (string) ($raw['type'] ?? '');
            if ($id === '' || $label === '') {
                $errors[] = 'Every field must have an ID and a label.';
                continue;
            }
            if (isset($seen[$id])) {
                $errors[] = 'Duplicate field ID: ' . $id;
            }
            $seen[$id] = true;
            if (!in_array($type, self::FIELD_TYPES, true)) {
                $errors[] = 'Field "' . $label . '" has an unknown type.';
                continue;
            }

            $field = [
                'id' => $id,
                'label' => $label,
                'type' => $type,
                'required' => (bool) ($raw['required'] ?? false),
            ];
            foreach (['placeholder', 'helpText', 'accept'] as $textKey) {
                if (isset($raw[$textKey]) && is_string($raw[$textKey])) {
                    $field[$textKey] = $raw[$textKey];
                }
            }
            if (array_key_exists('defaultValue', $raw)) {
                $defaultValue = $raw['defaultValue'];
                if (is_string($defaultValue) || is_int($defaultValue) || is_float($defaultValue) || is_bool($defaultValue) || $defaultValue === null) {
                    $field['defaultValue'] = $defaultValue;
                }
            }
            if (isset($raw['options']) && is_array($raw['options'])) {
                $field['options'] = $this->options($raw['options'], $label, $activating || $type === 'select' || $type === 'radio', $errors);
            } elseif ($activating && ($type === 'select' || $type === 'radio')) {
                $errors[] = 'Field "' . $label . '" needs options.';
            }
            foreach (['min', 'max', 'maxLength', 'maxFileSizeMb'] as $numberKey) {
                if (isset($raw[$numberKey]) && is_numeric($raw[$numberKey])) {
                    $field[$numberKey] = $raw[$numberKey] + 0;
                }
            }
            if (isset($field['min'], $field['max']) && $field['min'] > $field['max']) {
                $errors[] = 'Field "' . $label . '" has an invalid number range.';
            }
            if (isset($field['maxLength']) && $field['maxLength'] <= 0) {
                $errors[] = 'Field "' . $label . '" has an invalid max length.';
            }
            if (isset($field['maxFileSizeMb']) && $field['maxFileSizeMb'] <= 0) {
                $errors[] = 'Field "' . $label . '" has an invalid max file size.';
            }
            $fields[] = $field;
        }

        return $fields;
    }

    /**
     * @param list<mixed> $rawOptions
     * @param list<string> $errors
     * @return list<array{value: string, label: string}>
     */
    private function options(array $rawOptions, string $fieldLabel, bool $required, array &$errors): array
    {
        $options = [];
        $values = [];
        foreach ($rawOptions as $raw) {
            if (!is_array($raw)) {
                $errors[] = 'Field "' . $fieldLabel . '" has an incomplete option.';
                continue;
            }
            $value = trim((string) ($raw['value'] ?? ''));
            $label = trim((string) ($raw['label'] ?? ''));
            if ($value === '' || $label === '') {
                $errors[] = 'Field "' . $fieldLabel . '" has an incomplete option.';
                continue;
            }
            if (isset($values[$value])) {
                $errors[] = 'Field "' . $fieldLabel . '" has duplicate option values.';
            }
            $values[$value] = true;
            $options[] = ['value' => $value, 'label' => $label];
        }
        if ($required && $options === []) {
            $errors[] = 'Field "' . $fieldLabel . '" needs options.';
        }

        return $options;
    }

    /**
     * @param list<string> $errors
     * @return array{type: string, workflow: array<string, mixed>}
     */
    private function workflow(mixed $value, bool $activating, array &$errors): array
    {
        if (!is_array($value) || !isset($value['type'])) {
            $errors[] = 'Workflow type must be review_checking or hierarchy_approval.';
            return ['type' => 'review_checking', 'workflow' => ['type' => 'review_checking']];
        }

        $type = (string) $value['type'];
        if ($type === 'review_checking') {
            return ['type' => $type, 'workflow' => ['type' => 'review_checking']];
        }
        if ($type !== 'hierarchy_approval') {
            $errors[] = 'Workflow type must be review_checking or hierarchy_approval.';
            return ['type' => 'review_checking', 'workflow' => ['type' => 'review_checking']];
        }

        $rawSteps = $value['steps'] ?? [];
        if (!is_array($rawSteps)) {
            $errors[] = 'Hierarchy steps must be a list.';
            $rawSteps = [];
        }
        if ($activating && $rawSteps === []) {
            $errors[] = 'Hierarchy Approval requires at least one approval step.';
        }

        $steps = [];
        $seen = [];
        foreach (array_values($rawSteps) as $index => $raw) {
            if (!is_array($raw)) {
                $errors[] = 'Approval step ' . ($index + 1) . ' must be an object.';
                continue;
            }
            $id = trim((string) ($raw['id'] ?? ''));
            $roleLabel = trim((string) ($raw['roleLabel'] ?? ''));
            $assignee = trim((string) ($raw['assigneeUserId'] ?? ''));
            if ($id === '' || isset($seen[$id])) {
                $errors[] = 'Approval step ' . ($index + 1) . ' must have a unique step ID.';
            } else {
                $seen[$id] = true;
            }
            if ($roleLabel === '') {
                $errors[] = 'Approval step ' . ($index + 1) . ' needs a role / responsibility label.';
            }
            if ($activating && $assignee === '') {
                $errors[] = 'Approval step ' . ($index + 1) . ' needs an assigned approver.';
            } elseif ($assignee !== '') {
                if (preg_match('/^\d+$/', $assignee) !== 1) {
                    $errors[] = 'Approval step ' . ($index + 1) . ' has an invalid approver.';
                } else {
                    $employee = $this->employees->find((int) $assignee);
                    if ($employee === null) {
                        $errors[] = 'Approval step ' . ($index + 1) . ' references an unknown user (' . $assignee . ').';
                    } elseif ($activating && $employee['status'] !== 'Active') {
                        $errors[] = 'Approval step ' . ($index + 1) . ' assignee is inactive.';
                    } elseif ($activating && ($employee['groupId'] === '' || $this->groups->find((int) $employee['groupId']) === null)) {
                        $errors[] = 'Approval step ' . ($index + 1) . ' assignee belongs to an unknown group.';
                    }
                }
            }
            $steps[] = [
                'id' => $id,
                'stepOrder' => $index + 1,
                'roleLabel' => $roleLabel,
                'assigneeUserId' => $assignee,
            ];
        }

        return [
            'type' => 'hierarchy_approval',
            'workflow' => ['type' => 'hierarchy_approval', 'steps' => $steps],
        ];
    }
}
