<?php

declare(strict_types=1);

namespace App\Models;

use App\Database;
use App\HttpException;
use App\RequestFields;
use PDO;
use Throwable;

/**
 * Request create, decision, resubmit, and cancel.
 * The signed-in employee is the only requester. Client employee ids are ignored.
 */
final class RequestModel
{
    /**
     * @param array<string, mixed> $actor
     * @param array<string, mixed> $template
     * @param array<string, mixed> $fieldValues
     * @param list<array<string, mixed>> $assignments
     * @param array{id: string, name: string, departmentId: string|null, departmentName: string|null} $group
     * @return array<string, mixed>
     */
    public function create(
        array $actor,
        array $template,
        array $fieldValues,
        array $assignments,
        array $group,
    ): array {
        if ($assignments === []) {
            throw new HttpException('This request has nobody assigned to act on it.', 400);
        }

        $pdo = $this->db();
        $now = $this->now();
        $pdo->beginTransaction();
        try {
            $versionId = $this->versionId($pdo, (int) $template['id'], (int) $template['version']);
            $requestNumber = $this->nextNumber($pdo, $now);
            $workflowType = (string) ($template['workflow']['type'] ?? '');
            $definitions = json_encode($template['fields'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $values = $this->encodeObject($fieldValues);
            $workflow = $this->encodeObject($template['workflow']);

            $insert = $pdo->prepare(
                'INSERT INTO requests (
                    request_number, template_id, template_version_id,
                    requester_employee_id, requester_name_snapshot,
                    group_id_snapshot, group_name_snapshot,
                    department_id_snapshot, department_name_snapshot,
                    status, current_revision_number, row_version,
                    submitted_at, updated_at
                 ) VALUES (
                    :requestNumber, :templateId, :templateVersionId,
                    :requesterId, :requesterName,
                    :groupId, :groupName,
                    :departmentId, :departmentName,
                    \'Pending\', 1, 1,
                    :submittedAt, :updatedAt
                 )'
            );
            $insert->execute([
                'requestNumber' => $requestNumber,
                'templateId' => (int) $template['id'],
                'templateVersionId' => $versionId,
                'requesterId' => (string) $actor['id'],
                'requesterName' => (string) $actor['name'],
                'groupId' => $group['id'],
                'groupName' => $group['name'],
                'departmentId' => $group['departmentId'],
                'departmentName' => $group['departmentName'],
                'submittedAt' => $now,
                'updatedAt' => $now,
            ]);
            $requestId = (int) $pdo->lastInsertId();

            $revision = $pdo->prepare(
                'INSERT INTO request_revisions (
                    request_id, revision_number, template_version_id,
                    template_name_snapshot, workflow_type,
                    field_definitions_json, field_values_json, workflow_snapshot_json, attachments_json,
                    submitted_by, submitted_by_name, submitted_at, outcome
                 ) VALUES (
                    :requestId, 1, :templateVersionId,
                    :templateName, :workflowType,
                    :fieldDefinitions, :fieldValues, :workflowSnapshot, \'[]\',
                    :submittedBy, :submittedByName, :submittedAt, \'Pending\'
                 )'
            );
            $revision->execute([
                'requestId' => $requestId,
                'templateVersionId' => $versionId,
                'templateName' => (string) $template['name'],
                'workflowType' => $workflowType,
                'fieldDefinitions' => $definitions,
                'fieldValues' => $values,
                'workflowSnapshot' => $workflow,
                'submittedBy' => (string) $actor['id'],
                'submittedByName' => (string) $actor['name'],
                'submittedAt' => $now,
            ]);
            $revisionId = (int) $pdo->lastInsertId();
            $this->insertAssignments($pdo, $revisionId, $assignments, $now);
            $this->addActivity(
                $pdo,
                $requestId,
                $revisionId,
                1,
                'request_submitted',
                (string) $actor['id'],
                (string) $actor['name'],
                'Request submitted',
                null,
                null,
                $now,
            );
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return $this->requirePresented($requestId);
    }

    /**
     * @param array<string, mixed> $actor
     * @return array<string, mixed>
     */
    public function decide(int $id, array $actor, string $decision, ?string $comment, int $rowVersion): array
    {
        if (!in_array($decision, ['approve', 'reject', 'return'], true)) {
            throw new HttpException('Decision must be approve, reject, or return.', 400);
        }
        $comment = trim((string) $comment);
        if (($decision === 'reject' || $decision === 'return') && $comment === '') {
            throw new HttpException('A comment is required when rejecting or returning a request.', 400);
        }
        $storedComment = $comment === '' ? null : $comment;

        $pdo = $this->db();
        $now = $this->now();
        $pdo->beginTransaction();
        try {
            $request = $this->lockRequest($pdo, $id);
            $employeeId = (string) $actor['id'];
            $this->assertVisible($pdo, $id, $employeeId);
            $this->assertRowVersion($request, $rowVersion);
            if ($request['status'] !== 'Pending') {
                throw new HttpException('This request is ' . $request['status'] . ' and cannot be decided.', 400);
            }

            $revision = $this->lockCurrentRevision($pdo, $id, (int) $request['current_revision_number']);
            $assignment = $this->actingAssignment($pdo, (int) $revision['id'], $employeeId);
            $nextStatus = match ($decision) {
                'approve' => 'Approved',
                'reject' => 'Rejected',
                'return' => 'Returned',
            };
            $updateAssignment = $pdo->prepare(
                'UPDATE request_approval_assignments SET status = :status WHERE id = :id'
            );
            $updateAssignment->execute([
                'status' => $nextStatus,
                'id' => (int) $assignment['id'],
            ]);
            $insertDecision = $pdo->prepare(
                'INSERT INTO approval_decisions (assignment_id, decision, decided_by, remarks, decided_at)
                 VALUES (:assignmentId, :decision, :decidedBy, :remarks, :decidedAt)'
            );
            $insertDecision->execute([
                'assignmentId' => (int) $assignment['id'],
                'decision' => $decision,
                'decidedBy' => $employeeId,
                'remarks' => $storedComment,
                'decidedAt' => $now,
            ]);

            $revisionId = (int) $revision['id'];
            $revisionNumber = (int) $revision['revision_number'];
            $actorName = (string) $actor['name'];
            $workflowType = (string) $revision['workflow_type'];
            if ($workflowType === 'review_checking') {
                $this->finishReview(
                    $pdo,
                    $id,
                    $revisionId,
                    $revisionNumber,
                    $decision,
                    $employeeId,
                    $actorName,
                    $storedComment,
                    $now,
                );
            } else {
                $this->finishHierarchy(
                    $pdo,
                    $id,
                    $revisionId,
                    $revisionNumber,
                    $decision,
                    (int) $assignment['step_order'],
                    (string) ($assignment['role_label'] ?? ''),
                    $employeeId,
                    $actorName,
                    $storedComment,
                    $now,
                );
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return $this->requirePresented($id);
    }

    /**
     * @param array<string, mixed> $actor
     * @param array<mixed> $fieldValues
     * @return array<string, mixed>
     */
    public function resubmit(int $id, array $actor, array $fieldValues, int $rowVersion): array
    {
        $pdo = $this->db();
        $now = $this->now();
        $pdo->beginTransaction();
        try {
            $request = $this->lockRequest($pdo, $id);
            $employeeId = (string) $actor['id'];
            $this->assertVisible($pdo, $id, $employeeId);
            $this->assertRowVersion($request, $rowVersion);
            if ((string) $request['requester_employee_id'] !== $employeeId) {
                throw new HttpException('Only the original requester can resubmit this request.', 403);
            }
            if ($request['status'] !== 'Returned') {
                throw new HttpException('This request is ' . $request['status'] . ' and cannot be resubmitted.', 400);
            }

            $revision = $this->lockCurrentRevision($pdo, $id, (int) $request['current_revision_number']);
            $definitions = $this->decodeList($revision['field_definitions_json']);
            $values = RequestFields::normalize($definitions, $fieldValues);
            $previousValues = $this->decodeObject($revision['field_values_json']);
            if (RequestFields::unchanged($definitions, $previousValues, $values)) {
                throw new HttpException('Change at least one answer before resubmitting.', 400);
            }
            $nextNumber = (int) $revision['revision_number'] + 1;

            $insert = $pdo->prepare(
                'INSERT INTO request_revisions (
                    request_id, revision_number, template_version_id,
                    template_name_snapshot, workflow_type,
                    field_definitions_json, field_values_json, workflow_snapshot_json, attachments_json,
                    submitted_by, submitted_by_name, submitted_at, outcome
                 ) VALUES (
                    :requestId, :revisionNumber, :templateVersionId,
                    :templateName, :workflowType,
                    :fieldDefinitions, :fieldValues, :workflowSnapshot, \'[]\',
                    :submittedBy, :submittedByName, :submittedAt, \'Pending\'
                 )'
            );
            $insert->execute([
                'requestId' => $id,
                'revisionNumber' => $nextNumber,
                'templateVersionId' => (int) $revision['template_version_id'],
                'templateName' => (string) $revision['template_name_snapshot'],
                'workflowType' => (string) $revision['workflow_type'],
                'fieldDefinitions' => is_string($revision['field_definitions_json'])
                    ? $revision['field_definitions_json']
                    : json_encode($revision['field_definitions_json'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'fieldValues' => $this->encodeObject($values),
                'workflowSnapshot' => is_string($revision['workflow_snapshot_json'])
                    ? $revision['workflow_snapshot_json']
                    : json_encode($revision['workflow_snapshot_json'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'submittedBy' => $employeeId,
                'submittedByName' => (string) $actor['name'],
                'submittedAt' => $now,
            ]);
            $newRevisionId = (int) $pdo->lastInsertId();
            $this->copyAssignments($pdo, (int) $revision['id'], $newRevisionId, (string) $revision['workflow_type'], $now);

            $update = $pdo->prepare(
                'UPDATE requests
                 SET status = \'Pending\',
                     current_revision_number = :revisionNumber,
                     last_resubmitted_at = :resubmittedAt,
                     updated_at = :updatedAt,
                     completed_at = NULL,
                     row_version = row_version + 1
                 WHERE id = :id'
            );
            $update->execute([
                'revisionNumber' => $nextNumber,
                'resubmittedAt' => $now,
                'updatedAt' => $now,
                'id' => $id,
            ]);
            $this->addActivity(
                $pdo,
                $id,
                $newRevisionId,
                $nextNumber,
                'request_resubmitted',
                $employeeId,
                (string) $actor['name'],
                'Request resubmitted as revision ' . $nextNumber,
                null,
                null,
                $now,
            );
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return $this->requirePresented($id);
    }

    /**
     * @param array<string, mixed> $actor
     * @return array<string, mixed>
     */
    public function cancel(int $id, array $actor, ?string $reason, int $rowVersion): array
    {
        $reason = trim((string) $reason);
        if (strlen($reason) > 2000) {
            throw new HttpException('Cancellation reason must be 2000 characters or fewer.', 400);
        }
        $storedReason = $reason === '' ? null : $reason;

        $pdo = $this->db();
        $now = $this->now();
        $pdo->beginTransaction();
        try {
            $request = $this->lockRequest($pdo, $id);
            $employeeId = (string) $actor['id'];
            $this->assertVisible($pdo, $id, $employeeId);
            $this->assertRowVersion($request, $rowVersion);
            if ((string) $request['requester_employee_id'] !== $employeeId) {
                throw new HttpException('Only the original requester can cancel this request.', 403);
            }
            if ($request['status'] !== 'Pending' && $request['status'] !== 'Returned') {
                throw new HttpException('This request is ' . $request['status'] . ' and cannot be cancelled.', 400);
            }

            $revision = $this->lockCurrentRevision($pdo, $id, (int) $request['current_revision_number']);
            if ($request['status'] === 'Pending') {
                $this->closeRevision($pdo, (int) $revision['id'], 'Cancelled', $now);
            }

            $update = $pdo->prepare(
                'UPDATE requests
                 SET status = \'Cancelled\',
                     cancelled_by = :cancelledBy,
                     cancelled_by_name = :cancelledByName,
                     cancelled_at = :cancelledAt,
                     cancellation_reason = :reason,
                     completed_at = :completedAt,
                     updated_at = :updatedAt,
                     row_version = row_version + 1
                 WHERE id = :id'
            );
            $update->execute([
                'cancelledBy' => $employeeId,
                'cancelledByName' => (string) $actor['name'],
                'cancelledAt' => $now,
                'reason' => $storedReason,
                'completedAt' => $now,
                'updatedAt' => $now,
                'id' => $id,
            ]);
            $this->addActivity(
                $pdo,
                $id,
                (int) $revision['id'],
                (int) $revision['revision_number'],
                'request_cancelled',
                $employeeId,
                (string) $actor['name'],
                'Request cancelled by requester',
                $storedReason,
                null,
                $now,
            );
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return $this->requirePresented($id);
    }

    /**
     * @param array<string, mixed> $actor
     * @return list<array<string, mixed>>
     */
    public function list(string $view, array $actor): array
    {
        $employeeId = (string) $actor['id'];
        if ($view === 'mine') {
            return $this->presentMany($this->mineIds($employeeId));
        }
        if ($view === 'inbox') {
            $rows = $this->inboxRows($employeeId);
            $presented = $this->presentMap(array_column($rows, 'id'));
            $items = [];
            foreach ($rows as $row) {
                $id = (int) $row['id'];
                if (!isset($presented[$id])) {
                    continue;
                }
                $items[] = [
                    'request' => $presented[$id],
                    'canAct' => (int) $row['can_act'] === 1,
                ];
            }

            return $items;
        }

        $inboxIds = [];
        foreach ($this->inboxRows($employeeId) as $row) {
            $inboxIds[(int) $row['id']] = true;
        }
        $latest = [];
        foreach ($this->decisionRows($employeeId) as $row) {
            $requestId = (int) $row['request_id'];
            if (isset($inboxIds[$requestId]) || isset($latest[$requestId])) {
                continue;
            }
            $latest[$requestId] = $row;
        }
        $presented = $this->presentMap(array_map('intval', array_keys($latest)));
        $items = [];
        foreach ($latest as $requestId => $row) {
            if (!isset($presented[$requestId])) {
                continue;
            }
            $decision = (string) $row['decision'];
            $items[] = [
                'request' => $presented[$requestId],
                'decision' => match ($decision) {
                    'approve' => 'Approved',
                    'reject' => 'Rejected',
                    'return' => 'Returned',
                    default => $decision,
                },
                'actionAt' => $this->iso((string) $row['decided_at']),
                'comments' => $row['remarks'] === null ? null : (string) $row['remarks'],
                'revisionNumber' => (int) $row['revision_number'],
            ];
        }

        return $items;
    }

    /** @return array<string, mixed> */
    public function show(int $id, string $employeeId): array
    {
        $pdo = $this->db();
        $exists = $pdo->prepare('SELECT 1 FROM requests WHERE id = :id');
        $exists->execute(['id' => $id]);
        if ($exists->fetchColumn() === false || !$this->isVisible($pdo, $id, $employeeId)) {
            throw new HttpException('Request not found.', 404);
        }

        return $this->requirePresented($id);
    }

    /** @param array<string, mixed> $request */
    private function assertRowVersion(array $request, int $rowVersion): void
    {
        if ((int) $request['row_version'] !== $rowVersion) {
            throw new HttpException('This request was updated by someone else. Reload and try again.', 409);
        }
    }

    /** @return array<string, mixed> */
    private function lockRequest(PDO $pdo, int $id): array
    {
        $statement = $pdo->prepare('SELECT * FROM requests WHERE id = :id FOR UPDATE');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new HttpException('Request not found.', 404);
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function lockCurrentRevision(PDO $pdo, int $requestId, int $revisionNumber): array
    {
        $statement = $pdo->prepare(
            'SELECT * FROM request_revisions
             WHERE request_id = :requestId AND revision_number = :revisionNumber
             FOR UPDATE'
        );
        $statement->execute([
            'requestId' => $requestId,
            'revisionNumber' => $revisionNumber,
        ]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new HttpException('Request data is incomplete.', 500);
        }

        return $row;
    }

    private function assertVisible(PDO $pdo, int $requestId, string $employeeId): void
    {
        if (!$this->isVisible($pdo, $requestId, $employeeId)) {
            throw new HttpException('Request not found.', 404);
        }
    }

    private function isVisible(PDO $pdo, int $requestId, string $employeeId): bool
    {
        $statement = $pdo->prepare(
            'SELECT 1
             FROM requests r
             WHERE r.id = :requestId
               AND (
                 r.requester_employee_id = :requesterId
                 OR EXISTS (
                   SELECT 1
                   FROM request_revisions rev
                   INNER JOIN request_approval_assignments a ON a.request_revision_id = rev.id
                   WHERE rev.request_id = r.id
                     AND a.resolved_employee_id = :assigneeId
                 )
               )'
        );
        $statement->execute([
            'requestId' => $requestId,
            'requesterId' => $employeeId,
            'assigneeId' => $employeeId,
        ]);

        return $statement->fetchColumn() !== false;
    }

    /** @return array<string, mixed> */
    private function actingAssignment(PDO $pdo, int $revisionId, string $employeeId): array
    {
        $statement = $pdo->prepare(
            'SELECT id, status, step_order, role_label, assignment_key
             FROM request_approval_assignments
             WHERE request_revision_id = :revisionId
               AND resolved_employee_id = :employeeId
             ORDER BY step_order ASC, id ASC
             FOR UPDATE'
        );
        $statement->execute([
            'revisionId' => $revisionId,
            'employeeId' => $employeeId,
        ]);
        $rows = $statement->fetchAll();
        if ($rows === []) {
            throw new HttpException('You do not have an active Pending assignment on this request.', 403);
        }
        foreach ($rows as $row) {
            if ($row['status'] === 'Pending') {
                return $row;
            }
        }
        foreach ($rows as $row) {
            if ($row['status'] === 'Waiting') {
                throw new HttpException('This step is still waiting for an earlier approval.', 403);
            }
        }

        throw new HttpException('You do not have an active Pending assignment on this request.', 403);
    }

    private function finishReview(
        PDO $pdo,
        int $requestId,
        int $revisionId,
        int $revisionNumber,
        string $decision,
        string $actorId,
        string $actorName,
        ?string $comment,
        string $now,
    ): void {
        $stepKey = 'reviewer:' . $actorId;
        if ($decision === 'approve') {
            $this->addActivity($pdo, $requestId, $revisionId, $revisionNumber, 'review_completed', $actorId, $actorName, 'Review completed', $comment, $stepKey, $now);
            if ($this->pendingCount($pdo, $revisionId) === 0) {
                $this->closeRevision($pdo, $revisionId, 'Approved', $now);
                $this->updateRequestStatus($pdo, $requestId, 'Approved', $now, true);
                $this->addActivity($pdo, $requestId, $revisionId, $revisionNumber, 'request_approved', $actorId, $actorName, 'Request approved — all reviewers completed their reviews', null, null, $now);
                return;
            }
            $this->touchRequest($pdo, $requestId, $now);
            return;
        }

        if ($decision === 'reject') {
            $this->closeRevision($pdo, $revisionId, 'Rejected', $now);
            $this->updateRequestStatus($pdo, $requestId, 'Rejected', $now, true);
            $this->addActivity($pdo, $requestId, $revisionId, $revisionNumber, 'request_rejected', $actorId, $actorName, 'Request rejected', $comment, $stepKey, $now);
            return;
        }

        $this->closeRevision($pdo, $revisionId, 'Returned', $now);
        $this->updateRequestStatus($pdo, $requestId, 'Returned', $now, false);
        $this->addActivity($pdo, $requestId, $revisionId, $revisionNumber, 'request_returned', $actorId, $actorName, 'Request returned for revision', $comment, $stepKey, $now);
    }

    private function finishHierarchy(
        PDO $pdo,
        int $requestId,
        int $revisionId,
        int $revisionNumber,
        string $decision,
        int $stepOrder,
        string $roleLabel,
        string $actorId,
        string $actorName,
        ?string $comment,
        string $now,
    ): void {
        $stepKey = 'step:' . $stepOrder;
        if ($decision === 'approve') {
            $this->addActivity(
                $pdo,
                $requestId,
                $revisionId,
                $revisionNumber,
                'approval_step_approved',
                $actorId,
                $actorName,
                'Approval step ' . $stepOrder . ' approved (' . $roleLabel . ')',
                $comment,
                $stepKey,
                $now,
            );
            $next = $pdo->prepare(
                'SELECT id
                 FROM request_approval_assignments
                 WHERE request_revision_id = :revisionId
                   AND status = \'Waiting\'
                   AND step_order > :stepOrder
                 ORDER BY step_order ASC, id ASC
                 LIMIT 1
                 FOR UPDATE'
            );
            $next->execute([
                'revisionId' => $revisionId,
                'stepOrder' => $stepOrder,
            ]);
            $nextId = $next->fetchColumn();
            if ($nextId !== false) {
                $promote = $pdo->prepare(
                    'UPDATE request_approval_assignments
                     SET status = \'Pending\', activated_at = :activatedAt
                     WHERE id = :id'
                );
                $promote->execute([
                    'activatedAt' => $now,
                    'id' => (int) $nextId,
                ]);
                $this->touchRequest($pdo, $requestId, $now);
                return;
            }

            $this->closeRevision($pdo, $revisionId, 'Approved', $now);
            $this->updateRequestStatus($pdo, $requestId, 'Approved', $now, true);
            $this->addActivity($pdo, $requestId, $revisionId, $revisionNumber, 'request_approved', $actorId, $actorName, 'Request approved — all approval steps completed', null, null, $now);
            return;
        }

        if ($decision === 'reject') {
            $this->closeRevision($pdo, $revisionId, 'Rejected', $now);
            $this->updateRequestStatus($pdo, $requestId, 'Rejected', $now, true);
            $this->addActivity(
                $pdo,
                $requestId,
                $revisionId,
                $revisionNumber,
                'request_rejected',
                $actorId,
                $actorName,
                'Request rejected at step ' . $stepOrder . ' (' . $roleLabel . ')',
                $comment,
                $stepKey,
                $now,
            );
            return;
        }

        $this->closeRevision($pdo, $revisionId, 'Returned', $now);
        $this->updateRequestStatus($pdo, $requestId, 'Returned', $now, false);
        $this->addActivity(
            $pdo,
            $requestId,
            $revisionId,
            $revisionNumber,
            'request_returned',
            $actorId,
            $actorName,
            'Request returned for revision at step ' . $stepOrder . ' (' . $roleLabel . ')',
            $comment,
            $stepKey,
            $now,
        );
    }

    private function pendingCount(PDO $pdo, int $revisionId): int
    {
        $statement = $pdo->prepare(
            'SELECT COUNT(*) FROM request_approval_assignments
             WHERE request_revision_id = :revisionId AND status = \'Pending\''
        );
        $statement->execute(['revisionId' => $revisionId]);

        return (int) $statement->fetchColumn();
    }

    private function closeRevision(PDO $pdo, int $revisionId, string $outcome, string $now): void
    {
        $statement = $pdo->prepare(
            'UPDATE request_revisions
             SET outcome = :outcome, closed_at = :closedAt
             WHERE id = :id'
        );
        $statement->execute([
            'outcome' => $outcome,
            'closedAt' => $now,
            'id' => $revisionId,
        ]);
    }

    private function updateRequestStatus(PDO $pdo, int $requestId, string $status, string $now, bool $complete): void
    {
        $statement = $pdo->prepare(
            'UPDATE requests
             SET status = :status,
                 updated_at = :updatedAt,
                 completed_at = :completedAt,
                 row_version = row_version + 1
             WHERE id = :id'
        );
        $statement->execute([
            'status' => $status,
            'updatedAt' => $now,
            'completedAt' => $complete ? $now : null,
            'id' => $requestId,
        ]);
    }

    private function touchRequest(PDO $pdo, int $requestId, string $now): void
    {
        $statement = $pdo->prepare(
            'UPDATE requests
             SET updated_at = :updatedAt, row_version = row_version + 1
             WHERE id = :id'
        );
        $statement->execute([
            'updatedAt' => $now,
            'id' => $requestId,
        ]);
    }

    /** @param list<array<string, mixed>> $assignments */
    private function insertAssignments(PDO $pdo, int $revisionId, array $assignments, string $now): void
    {
        $statement = $pdo->prepare(
            'INSERT INTO request_approval_assignments (
                request_revision_id, assignment_key, step_order, role_label,
                resolved_employee_id, employee_name_snapshot, group_name_snapshot, role_snapshot,
                status, activated_at, created_at
             ) VALUES (
                :revisionId, :assignmentKey, :stepOrder, :roleLabel,
                :employeeId, :employeeName, :groupName, :roleSnapshot,
                :status, :activatedAt, :createdAt
             )'
        );
        foreach ($assignments as $assignment) {
            $status = (string) $assignment['status'];
            $statement->execute([
                'revisionId' => $revisionId,
                'assignmentKey' => (string) $assignment['assignmentKey'],
                'stepOrder' => (int) $assignment['stepOrder'],
                'roleLabel' => $assignment['roleLabel'],
                'employeeId' => (string) $assignment['employeeId'],
                'employeeName' => (string) $assignment['employeeName'],
                'groupName' => (string) $assignment['groupName'],
                'roleSnapshot' => (string) $assignment['roleSnapshot'],
                'status' => $status,
                'activatedAt' => $status === 'Pending' ? $now : null,
                'createdAt' => $now,
            ]);
        }
    }

    private function copyAssignments(PDO $pdo, int $fromRevisionId, int $toRevisionId, string $workflowType, string $now): void
    {
        $statement = $pdo->prepare(
            'SELECT assignment_key, step_order, role_label, resolved_employee_id,
                    employee_name_snapshot, group_name_snapshot, role_snapshot
             FROM request_approval_assignments
             WHERE request_revision_id = :revisionId
             ORDER BY step_order ASC, id ASC
             FOR UPDATE'
        );
        $statement->execute(['revisionId' => $fromRevisionId]);
        $rows = $statement->fetchAll();
        $assignments = [];
        foreach ($rows as $index => $row) {
            $status = 'Pending';
            if ($workflowType === 'hierarchy_approval' && $index !== 0) {
                $status = 'Waiting';
            }
            $assignments[] = [
                'assignmentKey' => (string) $row['assignment_key'],
                'stepOrder' => (int) $row['step_order'],
                'roleLabel' => $row['role_label'],
                'employeeId' => (string) $row['resolved_employee_id'],
                'employeeName' => (string) $row['employee_name_snapshot'],
                'groupName' => (string) $row['group_name_snapshot'],
                'roleSnapshot' => (string) $row['role_snapshot'],
                'status' => $status,
            ];
        }
        $this->insertAssignments($pdo, $toRevisionId, $assignments, $now);
    }

    private function addActivity(
        PDO $pdo,
        int $requestId,
        ?int $revisionId,
        int $revisionNumber,
        string $type,
        string $actorId,
        string $actorName,
        string $description,
        ?string $comment,
        ?string $stepKey,
        string $now,
    ): void {
        $statement = $pdo->prepare(
            'INSERT INTO request_activity (
                request_id, request_revision_id, revision_number, event_type,
                actor_employee_id, actor_name_snapshot, description, remarks, related_step_key, created_at
             ) VALUES (
                :requestId, :revisionId, :revisionNumber, :eventType,
                :actorId, :actorName, :description, :remarks, :stepKey, :createdAt
             )'
        );
        $statement->execute([
            'requestId' => $requestId,
            'revisionId' => $revisionId,
            'revisionNumber' => $revisionNumber,
            'eventType' => $type,
            'actorId' => $actorId,
            'actorName' => $actorName,
            'description' => $description,
            'remarks' => $comment,
            'stepKey' => $stepKey,
            'createdAt' => $now,
        ]);
    }

    private function versionId(PDO $pdo, int $templateId, int $versionNumber): int
    {
        $statement = $pdo->prepare(
            'SELECT id FROM template_versions
             WHERE template_id = :templateId AND version_number = :versionNumber'
        );
        $statement->execute([
            'templateId' => $templateId,
            'versionNumber' => $versionNumber,
        ]);
        $id = $statement->fetchColumn();
        if ($id === false) {
            throw new HttpException('Template is not available.', 404);
        }

        return (int) $id;
    }

    private function nextNumber(PDO $pdo, string $now): string
    {
        $year = (int) (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Manila')))->format('Y');
        $seed = $pdo->prepare(
            'INSERT INTO request_number_sequences (year, last_number, updated_at)
             VALUES (:year, 0, :updatedAt)
             ON DUPLICATE KEY UPDATE year = year'
        );
        $seed->execute([
            'year' => $year,
            'updatedAt' => $now,
        ]);
        $select = $pdo->prepare(
            'SELECT last_number FROM request_number_sequences WHERE year = :year FOR UPDATE'
        );
        $select->execute(['year' => $year]);
        $next = (int) $select->fetchColumn() + 1;
        $update = $pdo->prepare(
            'UPDATE request_number_sequences
             SET last_number = :nextNumber, updated_at = :updatedAt
             WHERE year = :year'
        );
        $update->execute([
            'nextNumber' => $next,
            'updatedAt' => $now,
            'year' => $year,
        ]);

        return sprintf('SATS-%d-%06d', $year, $next);
    }

    /** @return list<int> */
    private function mineIds(string $employeeId): array
    {
        $statement = $this->db()->prepare(
            'SELECT id FROM requests
             WHERE requester_employee_id = :employeeId
             ORDER BY submitted_at DESC, id DESC'
        );
        $statement->execute(['employeeId' => $employeeId]);

        return $this->idsFrom($statement);
    }

    /** @return list<array{id: int, can_act: int}> */
    private function inboxRows(string $employeeId): array
    {
        $statement = $this->db()->prepare(
            'SELECT r.id,
                    MAX(CASE WHEN a.status = \'Pending\' THEN 1 ELSE 0 END) AS can_act,
                    COALESCE(r.last_resubmitted_at, r.submitted_at) AS sort_at
             FROM requests r
             INNER JOIN request_revisions rev
                     ON rev.request_id = r.id
                    AND rev.revision_number = r.current_revision_number
             INNER JOIN request_approval_assignments a
                     ON a.request_revision_id = rev.id
                    AND a.resolved_employee_id = :employeeId
             LEFT JOIN approval_decisions d ON d.assignment_id = a.id
             WHERE r.status = \'Pending\'
               AND d.id IS NULL
             GROUP BY r.id, COALESCE(r.last_resubmitted_at, r.submitted_at)
             ORDER BY can_act DESC, sort_at DESC, r.id DESC'
        );
        $statement->execute(['employeeId' => $employeeId]);
        $rows = [];
        foreach ($statement->fetchAll() as $row) {
            $rows[] = [
                'id' => (int) $row['id'],
                'can_act' => (int) $row['can_act'],
            ];
        }

        return $rows;
    }

    /** @return list<array<string, mixed>> */
    private function decisionRows(string $employeeId): array
    {
        $statement = $this->db()->prepare(
            'SELECT r.id AS request_id, d.decision, d.remarks, d.decided_at, rev.revision_number
             FROM approval_decisions d
             INNER JOIN request_approval_assignments a ON a.id = d.assignment_id
             INNER JOIN request_revisions rev ON rev.id = a.request_revision_id
             INNER JOIN requests r ON r.id = rev.request_id
             WHERE d.decided_by = :employeeId
             ORDER BY d.decided_at DESC, d.id DESC'
        );
        $statement->execute(['employeeId' => $employeeId]);

        return $statement->fetchAll();
    }

    /** @return array<string, mixed> */
    private function requirePresented(int $id): array
    {
        $presented = $this->presentMap([$id]);
        if (!isset($presented[$id])) {
            throw new HttpException('Request not found.', 404);
        }

        return $presented[$id];
    }

    /**
     * @param list<int> $ids
     * @return list<array<string, mixed>>
     */
    private function presentMany(array $ids): array
    {
        $presented = $this->presentMap($ids);
        $ordered = [];
        foreach ($ids as $id) {
            if (isset($presented[$id])) {
                $ordered[] = $presented[$id];
            }
        }

        return $ordered;
    }

    /**
     * @param list<int> $ids
     * @return array<int, array<string, mixed>>
     */
    private function presentMap(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids, static fn (int $id): bool => $id > 0)));
        if ($ids === []) {
            return [];
        }

        $pdo = $this->db();
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $requests = $pdo->prepare("SELECT * FROM requests WHERE id IN ($placeholders)");
        $requests->execute($ids);
        $requestRows = [];
        foreach ($requests->fetchAll() as $row) {
            $requestRows[(int) $row['id']] = $row;
        }

        $revisions = $pdo->prepare(
            "SELECT * FROM request_revisions WHERE request_id IN ($placeholders) ORDER BY revision_number ASC, id ASC"
        );
        $revisions->execute($ids);
        $revisionsByRequest = [];
        $revisionIds = [];
        foreach ($revisions->fetchAll() as $row) {
            $requestId = (int) $row['request_id'];
            $revisionsByRequest[$requestId][] = $row;
            $revisionIds[] = (int) $row['id'];
        }

        $assignmentsByRevision = [];
        if ($revisionIds !== []) {
            $revisionPlaceholders = implode(', ', array_fill(0, count($revisionIds), '?'));
            $assignments = $pdo->prepare(
                "SELECT a.*, d.decision, d.remarks, d.decided_at, d.decided_by
                 FROM request_approval_assignments a
                 LEFT JOIN approval_decisions d ON d.assignment_id = a.id
                 WHERE a.request_revision_id IN ($revisionPlaceholders)
                 ORDER BY a.step_order ASC, a.id ASC"
            );
            $assignments->execute($revisionIds);
            foreach ($assignments->fetchAll() as $row) {
                $assignmentsByRevision[(int) $row['request_revision_id']][] = $row;
            }
        }

        $activity = $pdo->prepare(
            "SELECT * FROM request_activity WHERE request_id IN ($placeholders) ORDER BY created_at ASC, id ASC"
        );
        $activity->execute($ids);
        $activityByRequest = [];
        foreach ($activity->fetchAll() as $row) {
            $activityByRequest[(int) $row['request_id']][] = $row;
        }

        $presented = [];
        foreach ($ids as $id) {
            if (!isset($requestRows[$id])) {
                continue;
            }
            $presented[$id] = $this->present(
                $requestRows[$id],
                $revisionsByRequest[$id] ?? [],
                $assignmentsByRevision,
                $activityByRequest[$id] ?? [],
            );
        }

        return $presented;
    }

    /**
     * @param array<string, mixed> $request
     * @param list<array<string, mixed>> $revisions
     * @param array<int, list<array<string, mixed>>> $assignmentsByRevision
     * @param list<array<string, mixed>> $activity
     * @return array<string, mixed>
     */
    private function present(array $request, array $revisions, array $assignmentsByRevision, array $activity): array
    {
        $currentNumber = (int) $request['current_revision_number'];
        $current = null;
        $history = [];
        foreach ($revisions as $revision) {
            $assignments = $assignmentsByRevision[(int) $revision['id']] ?? [];
            if ((int) $revision['revision_number'] === $currentNumber) {
                $current = [$revision, $assignments];
                continue;
            }
            $history[] = $this->presentRevision($revision, $assignments);
        }
        if ($current === null) {
            throw new HttpException('Request data is incomplete.', 500);
        }

        [$revision, $assignments] = $current;
        $workflowType = (string) $revision['workflow_type'];
        $people = $this->presentPeople($workflowType, $assignments);

        $events = [];
        foreach ($activity as $event) {
            $events[] = [
                'id' => (string) $event['id'],
                'type' => (string) $event['event_type'],
                'timestamp' => $this->iso((string) $event['created_at']),
                'actorId' => (string) $event['actor_employee_id'],
                'actorName' => (string) $event['actor_name_snapshot'],
                'description' => (string) $event['description'],
                'comment' => $event['remarks'] === null ? null : (string) $event['remarks'],
                'relatedStepKey' => $event['related_step_key'] === null ? null : (string) $event['related_step_key'],
                'revisionNumber' => (int) $event['revision_number'],
            ];
        }

        return [
            'id' => (string) $request['id'],
            'requestNumber' => (string) $request['request_number'],
            'templateId' => (string) $request['template_id'],
            'templateName' => (string) $revision['template_name_snapshot'],
            'workflowType' => $workflowType,
            'requesterId' => (string) $request['requester_employee_id'],
            'requesterName' => (string) $request['requester_name_snapshot'],
            'requesterGroupId' => (string) $request['group_id_snapshot'],
            'requesterGroupName' => (string) $request['group_name_snapshot'],
            'submittedAt' => $this->iso((string) $request['submitted_at']),
            'lastResubmittedAt' => $request['last_resubmitted_at'] === null
                ? null
                : $this->iso((string) $request['last_resubmitted_at']),
            'fieldValues' => $this->decodeObject($revision['field_values_json']),
            'attachments' => [],
            'fieldDefinitions' => $this->decodeList($revision['field_definitions_json']),
            'reviewers' => $people['reviewers'],
            'approvalSteps' => $people['approvalSteps'],
            'status' => (string) $request['status'],
            'revisionNumber' => $currentNumber,
            'revisions' => $history,
            'cancelledAt' => $request['cancelled_at'] === null ? null : $this->iso((string) $request['cancelled_at']),
            'cancelledById' => $request['cancelled_by'] === null ? null : (string) $request['cancelled_by'],
            'cancelledByName' => $request['cancelled_by_name'] === null ? null : (string) $request['cancelled_by_name'],
            'cancellationReason' => $request['cancellation_reason'] === null ? null : (string) $request['cancellation_reason'],
            'activity' => $events,
            'rowVersion' => (int) $request['row_version'],
        ];
    }

    /**
     * @param array<string, mixed> $revision
     * @param list<array<string, mixed>> $assignments
     * @return array<string, mixed>
     */
    private function presentRevision(array $revision, array $assignments): array
    {
        $workflowType = (string) $revision['workflow_type'];
        $people = $this->presentPeople($workflowType, $assignments);
        $presented = [
            'revisionNumber' => (int) $revision['revision_number'],
            'submittedAt' => $this->iso((string) $revision['submitted_at']),
            'submittedById' => (string) $revision['submitted_by'],
            'submittedByName' => (string) $revision['submitted_by_name'],
            'submissionType' => (int) $revision['revision_number'] === 1 ? 'original' : 'resubmitted',
            'fieldValues' => $this->decodeObject($revision['field_values_json']),
            'attachments' => [],
            'reviewers' => $people['reviewers'],
            'approvalSteps' => $people['approvalSteps'],
            'outcome' => (string) $revision['outcome'],
            'returnComment' => null,
            'returnedById' => null,
            'returnedByName' => null,
            'returnedByRole' => null,
            'returnedAt' => null,
        ];
        if ($revision['outcome'] !== 'Returned') {
            return $presented;
        }

        foreach ($assignments as $assignment) {
            if (($assignment['decision'] ?? null) !== 'return') {
                continue;
            }
            $presented['returnComment'] = $assignment['remarks'] === null ? null : (string) $assignment['remarks'];
            $presented['returnedById'] = (string) $assignment['resolved_employee_id'];
            $presented['returnedByName'] = (string) $assignment['employee_name_snapshot'];
            $presented['returnedByRole'] = $workflowType === 'hierarchy_approval'
                ? (string) ($assignment['role_label'] ?? $assignment['role_snapshot'])
                : (string) $assignment['role_snapshot'];
            $presented['returnedAt'] = $assignment['decided_at'] === null
                ? null
                : $this->iso((string) $assignment['decided_at']);
            break;
        }

        return $presented;
    }

    /**
     * @param list<array<string, mixed>> $assignments
     * @return array{reviewers: list<array<string, mixed>>|null, approvalSteps: list<array<string, mixed>>|null}
     */
    private function presentPeople(string $workflowType, array $assignments): array
    {
        if ($workflowType === 'hierarchy_approval') {
            $steps = [];
            foreach ($assignments as $assignment) {
                $steps[] = [
                    'stepOrder' => (int) $assignment['step_order'],
                    'roleLabel' => (string) ($assignment['role_label'] ?? ''),
                    'userId' => (string) $assignment['resolved_employee_id'],
                    'name' => (string) $assignment['employee_name_snapshot'],
                    'groupName' => (string) $assignment['group_name_snapshot'],
                    'status' => (string) $assignment['status'],
                    'comments' => $assignment['remarks'] === null ? null : (string) $assignment['remarks'],
                    'actionAt' => $assignment['decided_at'] === null ? null : $this->iso((string) $assignment['decided_at']),
                ];
            }

            return ['reviewers' => null, 'approvalSteps' => $steps];
        }

        $reviewers = [];
        foreach ($assignments as $assignment) {
            $reviewers[] = [
                'userId' => (string) $assignment['resolved_employee_id'],
                'name' => (string) $assignment['employee_name_snapshot'],
                'groupName' => (string) $assignment['group_name_snapshot'],
                'role' => (string) $assignment['role_snapshot'],
                'status' => (string) $assignment['status'],
                'comments' => $assignment['remarks'] === null ? null : (string) $assignment['remarks'],
                'actionAt' => $assignment['decided_at'] === null ? null : $this->iso((string) $assignment['decided_at']),
            ];
        }

        return ['reviewers' => $reviewers, 'approvalSteps' => null];
    }

    private function db(): PDO
    {
        return Database::sats();
    }

    /** @param array<string, mixed> $value */
    private function encodeObject(array $value): string
    {
        $flags = JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;
        if ($value === [] || array_is_list($value)) {
            return json_encode(new \stdClass(), $flags);
        }

        return json_encode($value, $flags);
    }

    /** @return array<string, mixed> */
    private function decodeObject(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        $decoded = json_decode((string) $value, false, 512, JSON_THROW_ON_ERROR);
        if (!is_object($decoded)) {
            return [];
        }

        $object = [];
        foreach ($decoded as $key => $item) {
            $object[(string) $key] = $item;
        }

        return $object;
    }

    /** @return list<mixed> */
    private function decodeList(mixed $value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }
        $decoded = json_decode((string) $value, true, 512, JSON_THROW_ON_ERROR);

        return is_array($decoded) ? array_values($decoded) : [];
    }

    /** @return list<int> */
    private function idsFrom(\PDOStatement $statement): array
    {
        $ids = [];
        foreach ($statement->fetchAll() as $row) {
            $ids[] = (int) $row['id'];
        }

        return $ids;
    }

    private function now(): string
    {
        return gmdate('Y-m-d H:i:s.u');
    }

    private function iso(string $value): string
    {
        $stamp = str_replace(' ', 'T', $value);

        return str_ends_with($stamp, 'Z') ? $stamp : $stamp . 'Z';
    }
}
