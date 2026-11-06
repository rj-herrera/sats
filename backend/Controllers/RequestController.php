<?php

declare(strict_types=1);

namespace App\Controllers;

use App\AttachmentStore;
use App\CurrentActor;
use App\HttpException;
use App\Models\EmployeeModel;
use App\Models\GroupModel;
use App\Models\RequestModel;
use App\Models\RoleModel;
use App\Models\TemplateModel;
use App\RequestFields;

final class RequestController
{
    public function __construct(
        private readonly CurrentActor $actor,
        private readonly RequestModel $requests,
        private readonly TemplateModel $templates,
        private readonly EmployeeModel $employees,
        private readonly GroupModel $groups,
        private readonly RoleModel $roles,
    ) {
    }

    public function index(): void
    {
        $user = $this->actor->requireActive();
        $view = $_GET['view'] ?? '';
        if (!in_array($view, ['mine', 'inbox', 'completed'], true)) {
            throw new HttpException('view must be mine, inbox, or completed.', 400);
        }

        json_response($this->requests->list($view, $user));
    }

    public function show(int $id): void
    {
        $user = $this->actor->requireActive();
        json_response($this->requests->show($id, (string) $user['id']));
    }

    public function create(): void
    {
        $user = $this->actor->requireActive();
        [$input, $uploads] = $this->submission();
        if (preg_match('/^\d+$/', (string) ($user['groupId'] ?? '')) !== 1) {
            throw new HttpException('Your group is not available.', 400);
        }

        $templateId = $input['templateId'] ?? null;
        if (!is_string($templateId) && !is_int($templateId)) {
            throw new HttpException('templateId is invalid.', 400);
        }
        if (preg_match('/^\d+$/', (string) $templateId) !== 1) {
            throw new HttpException('templateId is invalid.', 400);
        }

        $template = $this->templates->findAvailable((int) $templateId, (string) $user['groupId']);
        if ($template === null) {
            throw new HttpException('Template is not available.', 404);
        }

        $fieldValues = $input['fieldValues'] ?? [];
        if (!is_array($fieldValues)) {
            throw new HttpException('fieldValues must be an object.', 400);
        }
        $values = RequestFields::normalize($template['fields'], $fieldValues);
        $group = $this->groups->directoryProfile((int) $user['groupId']);
        if ($group === null) {
            throw new HttpException('Your group is not available.', 400);
        }

        $workflowType = (string) ($template['workflow']['type'] ?? '');
        $assignments = $workflowType === 'hierarchy_approval'
            ? $this->hierarchyAssignments($template['workflow']['steps'] ?? [])
            : $this->reviewAssignments($input['reviewerIds'] ?? null);

        json_response($this->requests->create($user, $template, $values, $assignments, $group, $uploads), 201);
    }

    public function decide(int $id): void
    {
        $user = $this->actor->requireActive();
        $input = read_json_body();
        $decision = $input['decision'] ?? '';
        if (!is_string($decision)) {
            throw new HttpException('Decision must be approve, reject, or return.', 400);
        }
        $comment = $input['comment'] ?? null;
        if ($comment !== null && !is_string($comment)) {
            throw new HttpException('Comment must be text.', 400);
        }

        json_response($this->requests->decide(
            $id,
            $user,
            $decision,
            $comment,
            $this->rowVersionFrom($input),
        ));
    }

    public function resubmit(int $id): void
    {
        $user = $this->actor->requireActive();
        [$input, $uploads] = $this->submission();
        $fieldValues = $input['fieldValues'] ?? [];
        if (!is_array($fieldValues)) {
            throw new HttpException('fieldValues must be an object.', 400);
        }

        json_response($this->requests->resubmit(
            $id,
            $user,
            $fieldValues,
            $this->rowVersionFrom($input),
            $uploads,
            $this->keptAttachmentIds($input),
        ));
    }

    public function download(int $id, string $attachmentId): void
    {
        $user = $this->actor->requireActive();
        $file = $this->requests->attachmentFile($id, $attachmentId, (string) $user['id']);
        $download = ($_GET['download'] ?? '') === '1';
        $type = $file['fileType'] !== '' ? $file['fileType'] : 'application/octet-stream';
        $ascii = preg_replace('/[^A-Za-z0-9._ -]/', '_', $file['fileName']) ?: 'file';
        $encoded = rawurlencode($file['fileName']);
        $disposition = $download ? 'attachment' : 'inline';

        header('Content-Type: ' . $type);
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . (string) filesize($file['path']));
        header("Content-Disposition: {$disposition}; filename=\"{$ascii}\"; filename*=UTF-8''{$encoded}");
        readfile($file['path']);
        exit;
    }

    public function cancel(int $id): void
    {
        $user = $this->actor->requireActive();
        $input = read_json_body();
        $reason = $input['reason'] ?? null;
        if ($reason !== null && !is_string($reason)) {
            throw new HttpException('Cancellation reason must be text.', 400);
        }

        json_response($this->requests->cancel(
            $id,
            $user,
            $reason,
            $this->rowVersionFrom($input),
        ));
    }

    /**
     * JSON, or a multipart body whose payload field is the same JSON.
     * Files arrive as files[{fieldId}][].
     *
     * @return array{0: array<string, mixed>, 1: list<array{fieldId: string, tmp: string, name: string, size: int, extension: string, type: string}>}
     */
    private function submission(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (!is_string($contentType) || !str_contains($contentType, 'multipart/form-data')) {
            return [read_json_body(), []];
        }

        $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($length > 0 && ($_POST === [] && $_FILES === [])) {
            throw new HttpException('The upload is too large. Each file must be 20 MB or smaller.', 400);
        }

        $raw = $_POST['payload'] ?? null;
        if (!is_string($raw) || trim($raw) === '') {
            throw new HttpException('Request body must be JSON.', 400);
        }
        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException('Request body must be JSON.', 400);
        }
        if (!is_array($decoded)) {
            throw new HttpException('Request body must be a JSON object.', 400);
        }

        return [$decoded, AttachmentStore::incoming()];
    }

    /**
     * @param array<string, mixed> $input
     * @return list<string>|null
     */
    private function keptAttachmentIds(array $input): ?array
    {
        if (!array_key_exists('keptAttachmentIds', $input)) {
            return null;
        }
        $ids = $input['keptAttachmentIds'];
        if (!is_array($ids) || !array_is_list($ids)) {
            throw new HttpException('keptAttachmentIds must be a list.', 400);
        }
        $kept = [];
        foreach ($ids as $id) {
            if (!is_string($id) || preg_match('/^[a-f0-9]{32}$/', $id) !== 1) {
                throw new HttpException('keptAttachmentIds must be a list.', 400);
            }
            $kept[] = $id;
        }

        return $kept;
    }

    /** @param array<string, mixed> $input */
    private function rowVersionFrom(array $input): int
    {
        $version = $input['rowVersion'] ?? null;
        $numeric = is_int($version) || (is_string($version) && preg_match('/^\d+$/', $version) === 1);
        if (!$numeric || (int) $version < 1) {
            throw new HttpException('rowVersion is required.', 400);
        }

        return (int) $version;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function reviewAssignments(mixed $reviewerIds): array
    {
        if (!is_array($reviewerIds) || !array_is_list($reviewerIds) || $reviewerIds === []) {
            throw new HttpException('Select at least one reviewer.', 400);
        }

        $seen = [];
        $assignments = [];
        $roles = $this->roles->activeRoleCodesByEmployee();
        foreach ($reviewerIds as $reviewerId) {
            if (!is_string($reviewerId) && !is_int($reviewerId)) {
                throw new HttpException('Reviewer id is invalid.', 400);
            }
            $id = (string) $reviewerId;
            if (preg_match('/^\d+$/', $id) !== 1) {
                throw new HttpException('Reviewer id is invalid.', 400);
            }
            if (isset($seen[$id])) {
                throw new HttpException('Reviewer list contains a duplicate.', 400);
            }
            $seen[$id] = true;
            $employee = $this->employees->find((int) $id);
            if ($employee === null) {
                throw new HttpException('A selected reviewer does not exist.', 400);
            }
            if ($employee['status'] !== 'Active') {
                throw new HttpException('A selected reviewer is inactive.', 400);
            }
            $assignments[] = $this->assignment(
                'reviewer:' . $id,
                1,
                null,
                $employee,
                $this->roleFor($id, $roles),
                'Pending',
            );
        }

        return $assignments;
    }

    /**
     * @param mixed $steps
     * @return list<array<string, mixed>>
     */
    private function hierarchyAssignments(mixed $steps): array
    {
        if (!is_array($steps) || $steps === []) {
            throw new HttpException('This template has no approval steps.', 400);
        }

        $ordered = array_values($steps);
        usort($ordered, static function (mixed $left, mixed $right): int {
            $leftOrder = is_array($left) ? (int) ($left['stepOrder'] ?? 0) : 0;
            $rightOrder = is_array($right) ? (int) ($right['stepOrder'] ?? 0) : 0;

            return $leftOrder <=> $rightOrder;
        });

        $roles = $this->roles->activeRoleCodesByEmployee();
        $assignments = [];
        foreach ($ordered as $index => $step) {
            if (!is_array($step)) {
                throw new HttpException('This template has no approval steps.', 400);
            }
            $assignee = trim((string) ($step['assigneeUserId'] ?? ''));
            $stepOrder = (int) ($step['stepOrder'] ?? ($index + 1));
            if (preg_match('/^\d+$/', $assignee) !== 1) {
                throw new HttpException('Approval step ' . $stepOrder . ' assignee does not exist.', 400);
            }
            $employee = $this->employees->find((int) $assignee);
            if ($employee === null) {
                throw new HttpException('Approval step ' . $stepOrder . ' assignee does not exist.', 400);
            }
            if ($employee['status'] !== 'Active') {
                throw new HttpException('Approval step ' . $stepOrder . ' assignee is inactive.', 400);
            }
            $assignments[] = $this->assignment(
                'step:' . $stepOrder,
                $stepOrder,
                trim((string) ($step['roleLabel'] ?? '')),
                $employee,
                $this->roleFor($assignee, $roles),
                $index === 0 ? 'Pending' : 'Waiting',
            );
        }

        return $assignments;
    }

    /**
     * @param array<string, mixed> $employee
     * @return array<string, mixed>
     */
    private function assignment(
        string $key,
        int $stepOrder,
        ?string $roleLabel,
        array $employee,
        string $role,
        string $status,
    ): array {
        return [
            'assignmentKey' => $key,
            'stepOrder' => $stepOrder,
            'roleLabel' => $roleLabel === '' ? null : $roleLabel,
            'employeeId' => (string) $employee['id'],
            'employeeName' => (string) $employee['name'],
            'groupName' => (string) $employee['groupName'],
            'roleSnapshot' => $role,
            'status' => $status,
        ];
    }

    /**
     * @param array<string, list<string>> $rolesByEmployee
     */
    private function roleFor(string $employeeId, array $rolesByEmployee): string
    {
        $codes = $rolesByEmployee[$employeeId] ?? [];
        if (in_array('APPROVER', $codes, true)) {
            return 'approver';
        }
        if (in_array('ADMIN', $codes, true)) {
            return 'admin';
        }

        return 'employee';
    }
}
