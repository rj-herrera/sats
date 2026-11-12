<?php

declare(strict_types=1);

/**
 * Loads the demonstration templates and requests from the SATS data-preparation
 * note. Decisions are fictional and are not company approvals.
 *
 * Run from the project root:
 *   C:\xampp\php\php.exe database\migrate_training_equipment.php
 *
 * Safe to run again: if both template names already exist, it changes nothing.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/backend/bootstrap.php';

use App\Database;

const TRAINING_NAME = 'Internal Training Session Request';
const EQUIPMENT_NAME = 'Temporary Equipment Loan Request';
const REQUESTER_ID = '518';

final class DemoMigration
{
    public function __construct(private readonly PDO $sats, private readonly PDO $directory)
    {
    }

    public function run(): void
    {
        $existing = $this->existingTemplateNames();
        $wanted = [TRAINING_NAME, EQUIPMENT_NAME];
        $found = array_values(array_intersect($wanted, $existing));
        if ($found === $wanted) {
            echo "Already migrated. Both templates are present.\n";
            return;
        }
        if ($found !== []) {
            throw new RuntimeException(
                'Partial migration found (' . implode(', ', $found) . '). Resolve it before running this again.'
            );
        }

        $group = $this->owningGroup();
        $authorId = $this->authorId();
        $requester = $this->employee(REQUESTER_ID);
        if ($requester['status'] !== '1' || $requester['group_id'] !== $group['id']) {
            throw new RuntimeException(
                'Requester ' . REQUESTER_ID . ' must be an active member of ' . $group['name'] . '.'
            );
        }
        $stageOne = $this->approver('212');
        $stageTwo = $this->approver('498');

        $trainingFields = $this->trainingFields();
        $equipmentFields = $this->equipmentFields();
        $trainingWorkflow = [
            'type' => 'hierarchy_approval',
            'steps' => [
                [
                    'id' => 'step-stage-1',
                    'stepOrder' => 1,
                    'roleLabel' => 'Approver',
                    'assigneeUserId' => '212',
                ],
                [
                    'id' => 'step-stage-2',
                    'stepOrder' => 2,
                    'roleLabel' => 'Approver',
                    'assigneeUserId' => '498',
                ],
            ],
        ];
        $equipmentWorkflow = ['type' => 'review_checking'];

        $this->sats->beginTransaction();
        try {
            $trainingId = $this->insertTemplate(
                TRAINING_NAME,
                'Request approval for an internal training session, knowledge-sharing activity, or skills development workshop.',
                'group',
                $group['id'],
                'hierarchy_approval',
                $trainingFields,
                $trainingWorkflow,
                [$group['id']],
                $authorId,
                '2026-11-10 01:00:00.000000',
            );
            $equipmentId = $this->insertTemplate(
                EQUIPMENT_NAME,
                'Request the temporary use of shared company equipment for authorized work-related activities.',
                'generic',
                null,
                'review_checking',
                $equipmentFields,
                $equipmentWorkflow,
                [],
                $authorId,
                '2026-11-10 01:05:00.000000',
            );

            $trainingVersionId = $this->versionId($trainingId);
            $equipmentVersionId = $this->versionId($equipmentId);
            $trainingDefinitions = $this->json($trainingFields);
            $equipmentDefinitions = $this->json($equipmentFields);
            $trainingSnapshot = $this->json($trainingWorkflow);
            $equipmentSnapshot = $this->json($equipmentWorkflow);

            $numbers = [];
            $numbers['TR-01'] = $this->insertPendingTraining(
                $trainingId,
                $trainingVersionId,
                $trainingDefinitions,
                $trainingSnapshot,
                $requester,
                $group,
                $stageOne,
                $stageTwo,
            );
            $numbers['TR-02'] = $this->insertRevisedTraining(
                $trainingId,
                $trainingVersionId,
                $trainingDefinitions,
                $trainingSnapshot,
                $requester,
                $group,
                $stageOne,
                $stageTwo,
            );
            $numbers['TR-03'] = $this->insertRejectedTraining(
                $trainingId,
                $trainingVersionId,
                $trainingDefinitions,
                $trainingSnapshot,
                $requester,
                $group,
                $stageOne,
                $stageTwo,
            );
            $numbers['EQ-03'] = $this->insertRejectedEquipment(
                $equipmentId,
                $equipmentVersionId,
                $equipmentDefinitions,
                $equipmentSnapshot,
                $requester,
                $group,
                $stageTwo,
            );

            $this->sats->commit();
        } catch (Throwable $exception) {
            if ($this->sats->inTransaction()) {
                $this->sats->rollBack();
            }
            throw $exception;
        }

        echo "Migrated demonstration data.\n";
        echo 'Owning group: ' . $group['name'] . ' (' . $group['id'] . ")\n";
        echo 'Requester: ' . $requester['name'] . ' (' . $requester['id'] . ")\n";
        echo 'Stage 1 approver: ' . $stageOne['name'] . " (212)\n";
        echo 'Stage 2 approver / reviewer: ' . $stageTwo['name'] . " (498)\n";
        foreach ($numbers as $label => $number) {
            echo $label . ' -> ' . $number . "\n";
        }
    }

    /** @return list<string> */
    private function existingTemplateNames(): array
    {
        $statement = $this->sats->query('SELECT name FROM templates');
        $names = [];
        foreach ($statement->fetchAll() as $row) {
            $names[] = (string) $row['name'];
        }

        return $names;
    }

    /** @return array{id: string, name: string, department_id: string|null, department_name: string|null} */
    private function owningGroup(): array
    {
        $statement = $this->directory->query(
            'SELECT g.id, g.name, g.dept_id, d.name AS department_name
             FROM group_list g
             LEFT JOIN department_list d ON d.id = g.dept_id AND g.dept_id <> 0
             WHERE g.name IN (\'System\', \'Systems\', \'System Group\', \'Systems Group\')
             ORDER BY FIELD(g.name, \'System\', \'Systems\', \'System Group\', \'Systems Group\'), g.id
             LIMIT 1'
        );
        $row = $statement->fetch();
        if ($row === false) {
            throw new RuntimeException('No System or Systems Group was found in the directory.');
        }

        $deptId = (int) $row['dept_id'];
        $deptName = $row['department_name'] === null ? '' : trim((string) $row['department_name']);

        return [
            'id' => (string) $row['id'],
            'name' => trim((string) $row['name']),
            'department_id' => $deptId > 0 ? (string) $deptId : null,
            'department_name' => $deptId > 0 && $deptName !== '' ? $deptName : null,
        ];
    }

    private function authorId(): string
    {
        $statement = $this->sats->query(
            'SELECT employee_id
             FROM sats_role_assignments
             WHERE role_code = \'ADMIN\' AND is_active = 1
             ORDER BY assigned_at, id
             LIMIT 1'
        );
        $id = $statement->fetchColumn();
        if ($id === false || $id === null || $id === '') {
            throw new RuntimeException('No active administrator is available to own the templates.');
        }

        return (string) $id;
    }

    /** @return array{id: string, name: string, group_id: string, group_name: string, status: string} */
    private function employee(string $id): array
    {
        $statement = $this->directory->prepare(
            'SELECT e.id, e.firstname, e.surname, e.emp_status, e.group_id, g.name AS group_name
             FROM employee_list e
             LEFT JOIN group_list g ON g.id = e.group_id
             WHERE e.id = :id'
        );
        $statement->execute(['id' => (int) $id]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new RuntimeException('Employee ' . $id . ' was not found.');
        }

        return [
            'id' => (string) $row['id'],
            'name' => trim(trim((string) $row['firstname']) . ' ' . trim((string) $row['surname'])),
            'group_id' => (string) $row['group_id'],
            'group_name' => trim((string) ($row['group_name'] ?? '')),
            'status' => (string) $row['emp_status'],
        ];
    }

    /** @return array{id: string, name: string, group_id: string, group_name: string, status: string} */
    private function approver(string $id): array
    {
        $employee = $this->employee($id);
        if ($employee['status'] !== '1') {
            throw new RuntimeException('Approver ' . $id . ' is inactive.');
        }
        $statement = $this->sats->prepare(
            'SELECT 1
             FROM sats_role_assignments
             WHERE employee_id = :id AND role_code = \'APPROVER\' AND is_active = 1'
        );
        $statement->execute(['id' => $id]);
        if ($statement->fetchColumn() === false) {
            throw new RuntimeException('Employee ' . $id . ' is not an active approver.');
        }

        return $employee;
    }

    /**
     * @param list<array<string, mixed>> $fields
     * @param array<string, mixed> $workflow
     * @param list<string> $groupIds
     */
    private function insertTemplate(
        string $name,
        string $description,
        string $scope,
        ?string $owningGroupId,
        string $workflowType,
        array $fields,
        array $workflow,
        array $groupIds,
        string $authorId,
        string $now,
    ): int {
        $insert = $this->sats->prepare(
            'INSERT INTO templates (
                name, description, scope, owning_group_id, status,
                current_version_number, workflow_type, created_by, created_at, updated_by, updated_at
             ) VALUES (
                :name, :description, :scope, :owningGroupId, \'Active\',
                1, :workflowType, :createdBy, :createdAt, :updatedBy, :updatedAt
             )'
        );
        $insert->execute([
            'name' => $name,
            'description' => $description,
            'scope' => $scope,
            'owningGroupId' => $owningGroupId,
            'workflowType' => $workflowType,
            'createdBy' => $authorId,
            'createdAt' => $now,
            'updatedBy' => $authorId,
            'updatedAt' => $now,
        ]);
        $id = (int) $this->sats->lastInsertId();

        $version = $this->sats->prepare(
            'INSERT INTO template_versions (
                template_id, version_number, name, description, workflow_type,
                fields_json, workflow_json, created_by, created_at
             ) VALUES (
                :templateId, 1, :name, :description, :workflowType,
                :fields, :workflow, :createdBy, :createdAt
             )'
        );
        $version->execute([
            'templateId' => $id,
            'name' => $name,
            'description' => $description,
            'workflowType' => $workflowType,
            'fields' => $this->json($fields),
            'workflow' => $this->json($workflow),
            'createdBy' => $authorId,
            'createdAt' => $now,
        ]);

        $grant = $this->sats->prepare(
            'INSERT INTO template_allowed_groups (template_id, group_id, granted_by, granted_at)
             VALUES (:templateId, :groupId, :grantedBy, :grantedAt)'
        );
        foreach ($groupIds as $groupId) {
            $grant->execute([
                'templateId' => $id,
                'groupId' => $groupId,
                'grantedBy' => $authorId,
                'grantedAt' => $now,
            ]);
        }

        return $id;
    }

    private function versionId(int $templateId): int
    {
        $statement = $this->sats->prepare(
            'SELECT id FROM template_versions WHERE template_id = :templateId AND version_number = 1'
        );
        $statement->execute(['templateId' => $templateId]);

        return (int) $statement->fetchColumn();
    }

    /**
     * @param array{id: string, name: string, group_id: string, group_name: string, status: string} $requester
     * @param array{id: string, name: string, department_id: string|null, department_name: string|null} $group
     * @param array{id: string, name: string, group_name: string} $stageOne
     * @param array{id: string, name: string, group_name: string} $stageTwo
     */
    private function insertPendingTraining(
        int $templateId,
        int $versionId,
        string $definitions,
        string $workflow,
        array $requester,
        array $group,
        array $stageOne,
        array $stageTwo,
    ): string {
        $at = '2026-11-10 02:00:00.000000';
        $requestId = $this->insertRequest(
            $templateId,
            $versionId,
            $requester,
            $group,
            'Pending',
            1,
            1,
            $at,
            null,
            $at,
            null,
        );
        $revisionId = $this->insertRevision(
            $requestId,
            1,
            $versionId,
            TRAINING_NAME,
            'hierarchy_approval',
            $definitions,
            $this->trainingValues(
                'REST API Testing Skills Workshop',
                'option_1',
                '2026-12-04',
                3,
                10,
                2500,
                'Conduct an internal workshop on API testing fundamentals, including request validation, response checking, and error handling. Participants will prepare a reusable testing checklist.',
            ),
            $workflow,
            $requester,
            $at,
            'Pending',
            null,
        );
        $this->insertAssignment($revisionId, 'step:1', 1, 'Approver', $stageOne, 'approver', 'Pending', $at, $at);
        $this->insertAssignment($revisionId, 'step:2', 2, 'Approver', $stageTwo, 'approver', 'Waiting', null, $at);
        $this->insertActivity($requestId, $revisionId, 1, 'request_submitted', $requester, 'Request submitted', null, null, $at);

        return $this->requestNumber($requestId);
    }

    /**
     * @param array{id: string, name: string, group_id: string, group_name: string, status: string} $requester
     * @param array{id: string, name: string, department_id: string|null, department_name: string|null} $group
     * @param array{id: string, name: string, group_name: string} $stageOne
     * @param array{id: string, name: string, group_name: string} $stageTwo
     */
    private function insertRevisedTraining(
        int $templateId,
        int $versionId,
        string $definitions,
        string $workflow,
        array $requester,
        array $group,
        array $stageOne,
        array $stageTwo,
    ): string {
        $submitted = '2026-11-10 02:20:00.000000';
        $returned = '2026-11-10 03:05:00.000000';
        $resubmitted = '2026-11-10 04:40:00.000000';
        $approvedFirst = '2026-11-10 05:15:00.000000';
        $approvedFinal = '2026-11-10 06:00:00.000000';
        $returnComment = 'Please clarify the intended participants and specify the expected output of the session.';
        $revisedPurpose = 'Conduct an internal knowledge-sharing session for eight employees covering dashboard layout, data presentation, and KPI readability. Participants will produce a draft dashboard review checklist.';

        $requestId = $this->insertRequest(
            $templateId,
            $versionId,
            $requester,
            $group,
            'Approved',
            2,
            5,
            $submitted,
            $resubmitted,
            $approvedFinal,
            $approvedFinal,
        );
        $firstRevision = $this->insertRevision(
            $requestId,
            1,
            $versionId,
            TRAINING_NAME,
            'hierarchy_approval',
            $definitions,
            $this->trainingValues(
                'Dashboard Design Knowledge-Sharing Session',
                'option_2',
                '2026-12-01',
                2,
                8,
                600,
                'Review useful dashboard design practices.',
            ),
            $workflow,
            $requester,
            $submitted,
            'Returned',
            $returned,
        );
        $firstStep = $this->insertAssignment($firstRevision, 'step:1', 1, 'Approver', $stageOne, 'approver', 'Returned', $submitted, $submitted);
        $this->insertAssignment($firstRevision, 'step:2', 2, 'Approver', $stageTwo, 'approver', 'Waiting', null, $submitted);
        $this->insertDecision($firstStep, 'return', $stageOne['id'], $returnComment, $returned);
        $this->insertActivity($requestId, $firstRevision, 1, 'request_submitted', $requester, 'Request submitted', null, null, $submitted);
        $this->insertActivity(
            $requestId,
            $firstRevision,
            1,
            'request_returned',
            $stageOne,
            'Request returned for revision at step 1 (Approver)',
            $returnComment,
            'step:1',
            $returned,
        );

        $secondRevision = $this->insertRevision(
            $requestId,
            2,
            $versionId,
            TRAINING_NAME,
            'hierarchy_approval',
            $definitions,
            $this->trainingValues(
                'Dashboard Design Knowledge-Sharing Session',
                'option_2',
                '2026-12-01',
                2,
                8,
                600,
                $revisedPurpose,
            ),
            $workflow,
            $requester,
            $resubmitted,
            'Approved',
            $approvedFinal,
        );
        $secondStepOne = $this->insertAssignment($secondRevision, 'step:1', 1, 'Approver', $stageOne, 'approver', 'Approved', $resubmitted, $resubmitted);
        $secondStepTwo = $this->insertAssignment($secondRevision, 'step:2', 2, 'Approver', $stageTwo, 'approver', 'Approved', $approvedFirst, $resubmitted);
        $this->insertDecision($secondStepOne, 'approve', $stageOne['id'], null, $approvedFirst);
        $this->insertDecision($secondStepTwo, 'approve', $stageTwo['id'], null, $approvedFinal);
        $this->insertActivity($requestId, $secondRevision, 2, 'request_resubmitted', $requester, 'Request resubmitted as revision 2', null, null, $resubmitted);
        $this->insertActivity(
            $requestId,
            $secondRevision,
            2,
            'approval_step_approved',
            $stageOne,
            'Approval step 1 approved (Approver)',
            null,
            'step:1',
            $approvedFirst,
        );
        $this->insertActivity(
            $requestId,
            $secondRevision,
            2,
            'approval_step_approved',
            $stageTwo,
            'Approval step 2 approved (Approver)',
            null,
            'step:2',
            $approvedFinal,
        );
        $this->insertActivity(
            $requestId,
            $secondRevision,
            2,
            'request_approved',
            $stageTwo,
            'Request approved — all approval steps completed',
            null,
            null,
            $approvedFinal,
        );

        return $this->requestNumber($requestId);
    }

    /**
     * @param array{id: string, name: string, group_id: string, group_name: string, status: string} $requester
     * @param array{id: string, name: string, department_id: string|null, department_name: string|null} $group
     * @param array{id: string, name: string, group_name: string} $stageOne
     * @param array{id: string, name: string, group_name: string} $stageTwo
     */
    private function insertRejectedTraining(
        int $templateId,
        int $versionId,
        string $definitions,
        string $workflow,
        array $requester,
        array $group,
        array $stageOne,
        array $stageTwo,
    ): string {
        $submitted = '2026-11-10 02:35:00.000000';
        $rejected = '2026-11-10 03:25:00.000000';
        $comment = 'The proposed budget is beyond the amount allocated for this training activity. Please prepare a separate proposal if the requirements change.';

        $requestId = $this->insertRequest(
            $templateId,
            $versionId,
            $requester,
            $group,
            'Rejected',
            1,
            2,
            $submitted,
            null,
            $rejected,
            $rejected,
        );
        $revisionId = $this->insertRevision(
            $requestId,
            1,
            $versionId,
            TRAINING_NAME,
            'hierarchy_approval',
            $definitions,
            $this->trainingValues(
                'Advanced External Cloud Workshop',
                'option_4',
                '2026-12-15',
                16,
                3,
                42000,
                'Attend an external technical workshop covering cloud infrastructure, deployment fundamentals, and platform administration.',
            ),
            $workflow,
            $requester,
            $submitted,
            'Rejected',
            $rejected,
        );
        $step = $this->insertAssignment($revisionId, 'step:1', 1, 'Approver', $stageOne, 'approver', 'Rejected', $submitted, $submitted);
        $this->insertAssignment($revisionId, 'step:2', 2, 'Approver', $stageTwo, 'approver', 'Waiting', null, $submitted);
        $this->insertDecision($step, 'reject', $stageOne['id'], $comment, $rejected);
        $this->insertActivity($requestId, $revisionId, 1, 'request_submitted', $requester, 'Request submitted', null, null, $submitted);
        $this->insertActivity(
            $requestId,
            $revisionId,
            1,
            'request_rejected',
            $stageOne,
            'Request rejected at step 1 (Approver)',
            $comment,
            'step:1',
            $rejected,
        );

        return $this->requestNumber($requestId);
    }

    /**
     * @param array{id: string, name: string, group_id: string, group_name: string, status: string} $requester
     * @param array{id: string, name: string, department_id: string|null, department_name: string|null} $group
     * @param array{id: string, name: string, group_name: string} $reviewer
     */
    private function insertRejectedEquipment(
        int $templateId,
        int $versionId,
        string $definitions,
        string $workflow,
        array $requester,
        array $group,
        array $reviewer,
    ): string {
        $submitted = '2026-11-10 06:30:00.000000';
        $rejected = '2026-11-10 07:10:00.000000';
        $comment = 'The requested quantity cannot be accommodated for the specified dates. Please submit a new request with an alternative schedule or quantity.';
        $values = $this->json([
            'field_1' => 'Laptop Loan for Offsite Company Activity',
            'field_2' => 'option_3',
            'field_3' => 3,
            'field_4' => '2026-12-08',
            'field_5' => '2026-12-09',
            'field_6' => 'Request three laptops for a temporary offsite company activity involving presentation materials and data consolidation.',
            'field_7' => 'Main Office Equipment Storage',
            'field_8' => null,
        ]);

        $requestId = $this->insertRequest(
            $templateId,
            $versionId,
            $requester,
            $group,
            'Rejected',
            1,
            2,
            $submitted,
            null,
            $rejected,
            $rejected,
        );
        $revisionId = $this->insertRevision(
            $requestId,
            1,
            $versionId,
            EQUIPMENT_NAME,
            'review_checking',
            $definitions,
            $values,
            $workflow,
            $requester,
            $submitted,
            'Rejected',
            $rejected,
        );
        $assignmentId = $this->insertAssignment(
            $revisionId,
            'reviewer:' . $reviewer['id'],
            1,
            null,
            $reviewer,
            'approver',
            'Rejected',
            $submitted,
            $submitted,
        );
        $this->insertDecision($assignmentId, 'reject', $reviewer['id'], $comment, $rejected);
        $this->insertActivity($requestId, $revisionId, 1, 'request_submitted', $requester, 'Request submitted', null, null, $submitted);
        $this->insertActivity(
            $requestId,
            $revisionId,
            1,
            'request_rejected',
            $reviewer,
            'Request rejected',
            $comment,
            'reviewer:' . $reviewer['id'],
            $rejected,
        );

        return $this->requestNumber($requestId);
    }

    /**
     * @param array{id: string, name: string} $requester
     * @param array{id: string, name: string, department_id: string|null, department_name: string|null} $group
     */
    private function insertRequest(
        int $templateId,
        int $versionId,
        array $requester,
        array $group,
        string $status,
        int $revisionNumber,
        int $rowVersion,
        string $submittedAt,
        ?string $resubmittedAt,
        string $updatedAt,
        ?string $completedAt,
    ): int {
        $number = $this->allocateNumber($submittedAt);
        $insert = $this->sats->prepare(
            'INSERT INTO requests (
                request_number, template_id, template_version_id,
                requester_employee_id, requester_name_snapshot,
                group_id_snapshot, group_name_snapshot,
                department_id_snapshot, department_name_snapshot,
                status, current_revision_number, row_version,
                submitted_at, last_resubmitted_at, updated_at, completed_at
             ) VALUES (
                :requestNumber, :templateId, :templateVersionId,
                :requesterId, :requesterName,
                :groupId, :groupName,
                :departmentId, :departmentName,
                :status, :revisionNumber, :rowVersion,
                :submittedAt, :resubmittedAt, :updatedAt, :completedAt
             )'
        );
        $insert->execute([
            'requestNumber' => $number,
            'templateId' => $templateId,
            'templateVersionId' => $versionId,
            'requesterId' => $requester['id'],
            'requesterName' => $requester['name'],
            'groupId' => $group['id'],
            'groupName' => $group['name'],
            'departmentId' => $group['department_id'],
            'departmentName' => $group['department_name'],
            'status' => $status,
            'revisionNumber' => $revisionNumber,
            'rowVersion' => $rowVersion,
            'submittedAt' => $submittedAt,
            'resubmittedAt' => $resubmittedAt,
            'updatedAt' => $updatedAt,
            'completedAt' => $completedAt,
        ]);

        return (int) $this->sats->lastInsertId();
    }

    /**
     * @param array{id: string, name: string} $requester
     */
    private function insertRevision(
        int $requestId,
        int $revisionNumber,
        int $versionId,
        string $templateName,
        string $workflowType,
        string $definitions,
        string $values,
        string $workflow,
        array $requester,
        string $submittedAt,
        string $outcome,
        ?string $closedAt,
    ): int {
        $insert = $this->sats->prepare(
            'INSERT INTO request_revisions (
                request_id, revision_number, template_version_id,
                template_name_snapshot, workflow_type,
                field_definitions_json, field_values_json, workflow_snapshot_json, attachments_json,
                submitted_by, submitted_by_name, submitted_at, outcome, closed_at
             ) VALUES (
                :requestId, :revisionNumber, :templateVersionId,
                :templateName, :workflowType,
                :fieldDefinitions, :fieldValues, :workflowSnapshot, :attachments,
                :submittedBy, :submittedByName, :submittedAt, :outcome, :closedAt
             )'
        );
        $insert->execute([
            'requestId' => $requestId,
            'revisionNumber' => $revisionNumber,
            'templateVersionId' => $versionId,
            'templateName' => $templateName,
            'workflowType' => $workflowType,
            'fieldDefinitions' => $definitions,
            'fieldValues' => $values,
            'workflowSnapshot' => $workflow,
            'attachments' => '[]',
            'submittedBy' => $requester['id'],
            'submittedByName' => $requester['name'],
            'submittedAt' => $submittedAt,
            'outcome' => $outcome,
            'closedAt' => $closedAt,
        ]);

        return (int) $this->sats->lastInsertId();
    }

    /** @param array{id: string, name: string, group_name: string} $employee */
    private function insertAssignment(
        int $revisionId,
        string $key,
        int $stepOrder,
        ?string $roleLabel,
        array $employee,
        string $roleSnapshot,
        string $status,
        ?string $activatedAt,
        string $createdAt,
    ): int {
        $insert = $this->sats->prepare(
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
        $insert->execute([
            'revisionId' => $revisionId,
            'assignmentKey' => $key,
            'stepOrder' => $stepOrder,
            'roleLabel' => $roleLabel,
            'employeeId' => $employee['id'],
            'employeeName' => $employee['name'],
            'groupName' => $employee['group_name'],
            'roleSnapshot' => $roleSnapshot,
            'status' => $status,
            'activatedAt' => $activatedAt,
            'createdAt' => $createdAt,
        ]);

        return (int) $this->sats->lastInsertId();
    }

    private function insertDecision(
        int $assignmentId,
        string $decision,
        string $decidedBy,
        ?string $remarks,
        string $decidedAt,
    ): void {
        $insert = $this->sats->prepare(
            'INSERT INTO approval_decisions (assignment_id, decision, decided_by, remarks, decided_at)
             VALUES (:assignmentId, :decision, :decidedBy, :remarks, :decidedAt)'
        );
        $insert->execute([
            'assignmentId' => $assignmentId,
            'decision' => $decision,
            'decidedBy' => $decidedBy,
            'remarks' => $remarks,
            'decidedAt' => $decidedAt,
        ]);
    }

    /** @param array{id: string, name: string} $actor */
    private function insertActivity(
        int $requestId,
        int $revisionId,
        int $revisionNumber,
        string $eventType,
        array $actor,
        string $description,
        ?string $remarks,
        ?string $stepKey,
        string $createdAt,
    ): void {
        $insert = $this->sats->prepare(
            'INSERT INTO request_activity (
                request_id, request_revision_id, revision_number, event_type,
                actor_employee_id, actor_name_snapshot, description, remarks, related_step_key, created_at
             ) VALUES (
                :requestId, :revisionId, :revisionNumber, :eventType,
                :actorId, :actorName, :description, :remarks, :stepKey, :createdAt
             )'
        );
        $insert->execute([
            'requestId' => $requestId,
            'revisionId' => $revisionId,
            'revisionNumber' => $revisionNumber,
            'eventType' => $eventType,
            'actorId' => $actor['id'],
            'actorName' => $actor['name'],
            'description' => $description,
            'remarks' => $remarks,
            'stepKey' => $stepKey,
            'createdAt' => $createdAt,
        ]);
    }

    private function allocateNumber(string $now): string
    {
        $year = (int) (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y');
        $seed = $this->sats->prepare(
            'INSERT INTO request_number_sequences (year, last_number, updated_at)
             VALUES (:year, 0, :updatedAt)
             ON DUPLICATE KEY UPDATE year = year'
        );
        $seed->execute(['year' => $year, 'updatedAt' => $now]);
        $select = $this->sats->prepare(
            'SELECT last_number FROM request_number_sequences WHERE year = :year FOR UPDATE'
        );
        $select->execute(['year' => $year]);
        $next = (int) $select->fetchColumn() + 1;
        $update = $this->sats->prepare(
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

    private function requestNumber(int $requestId): string
    {
        $statement = $this->sats->prepare('SELECT request_number FROM requests WHERE id = :id');
        $statement->execute(['id' => $requestId]);

        return (string) $statement->fetchColumn();
    }

    private function trainingValues(
        string $topic,
        string $category,
        string $schedule,
        int $duration,
        int $participants,
        int $budget,
        string $purpose,
    ): string {
        return $this->json([
            'field_1' => $topic,
            'field_2' => $category,
            'field_3' => $schedule,
            'field_4' => $duration,
            'field_5' => $participants,
            'field_6' => $budget,
            'field_7' => $purpose,
            'field_8' => null,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function trainingFields(): array
    {
        return [
            $this->field('field_1', 'Training Topic', 'text', true, 'Name of the proposed session'),
            $this->select('field_2', 'Training Category', [
                ['value' => 'option_1', 'label' => 'Technical Skills'],
                ['value' => 'option_2', 'label' => 'Knowledge Sharing'],
                ['value' => 'option_3', 'label' => 'Process Improvement'],
                ['value' => 'option_4', 'label' => 'External Training'],
            ]),
            $this->field('field_3', 'Proposed Schedule', 'date', true, 'Proposed session date'),
            $this->field('field_4', 'Duration (Hours)', 'number', true, 'Expected duration'),
            $this->field('field_5', 'Estimated Participants', 'number', true, 'Number of participants'),
            $this->field('field_6', 'Estimated Budget', 'currency_php', true, 'Estimated training expenses'),
            $this->field('field_7', 'Purpose and Expected Outcome', 'textarea', true, 'Explain the need and expected output'),
            $this->file('field_8', 'Proposed Agenda', 'Supporting agenda or training outline'),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function equipmentFields(): array
    {
        return [
            $this->field('field_1', 'Request Title', 'text', true, 'Short description of equipment request'),
            $this->select('field_2', 'Equipment Type', [
                ['value' => 'option_1', 'label' => 'Projector'],
                ['value' => 'option_2', 'label' => 'Portable Monitor'],
                ['value' => 'option_3', 'label' => 'Laptop'],
                ['value' => 'option_4', 'label' => 'Presentation Speaker'],
                ['value' => 'option_5', 'label' => 'Other'],
            ]),
            $this->field('field_3', 'Quantity', 'number', true, 'Number of units requested'),
            $this->field('field_4', 'Needed From', 'date', true, 'Start date'),
            $this->field('field_5', 'Expected Return Date', 'date', true, 'Planned return date'),
            $this->field('field_6', 'Business Purpose', 'textarea', true, 'Reason equipment is required'),
            $this->field('field_7', 'Pickup / Return Location', 'text', true, 'Proposed location'),
            $this->file('field_8', 'Supporting Document', 'Additional reference document'),
        ];
    }

    /** @return array<string, mixed> */
    private function field(string $id, string $label, string $type, bool $required, string $placeholder): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'type' => $type,
            'required' => $required,
            'placeholder' => $placeholder,
        ];
    }

    /**
     * @param list<array{value: string, label: string}> $options
     * @return array<string, mixed>
     */
    private function select(string $id, string $label, array $options): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'type' => 'select',
            'required' => true,
            'options' => $options,
        ];
    }

    /** @return array<string, mixed> */
    private function file(string $id, string $label, string $helpText): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'type' => 'file',
            'required' => false,
            'helpText' => $helpText,
        ];
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}

try {
    $migration = new DemoMigration(Database::sats(), Database::connection());
    $migration->run();
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
