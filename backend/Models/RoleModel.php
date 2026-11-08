<?php

declare(strict_types=1);

namespace App\Models;

use App\Database;
use App\HttpException;
use PDO;
use Throwable;

/** Active SATS role assignments. employee_id matches employee_list.id as a string. */
final class RoleModel
{
    /** @return array<string, list<string>> */
    public function activeRoleCodesByEmployee(): array
    {
        $statement = $this->db()->query(
            'SELECT employee_id, role_code
             FROM sats_role_assignments
             WHERE is_active = 1'
        );

        $roles = [];
        foreach ($statement->fetchAll() as $row) {
            $employeeId = (string) $row['employee_id'];
            $roles[$employeeId][] = (string) $row['role_code'];
        }

        return $roles;
    }

    /**
     * Active group-template scope, keyed by employee id.
     * A GROUP_MANAGER row with no group does not grant management.
     *
     * @return array<string, string>
     */
    public function managedGroupIdsByEmployee(): array
    {
        $statement = $this->db()->query(
            'SELECT employee_id, group_id
             FROM sats_role_assignments
             WHERE is_active = 1
               AND role_code = \'GROUP_MANAGER\'
               AND group_id IS NOT NULL
               AND group_id <> \'\''
        );

        $groups = [];
        foreach ($statement->fetchAll() as $row) {
            $groups[(string) $row['employee_id']] = (string) $row['group_id'];
        }

        return $groups;
    }

    /**
     * Assignments for the administration screens, including inactive rows.
     *
     * @param list<string> $roleCodes
     * @return list<array<string, mixed>>
     */
    public function listAssignments(array $roleCodes): array
    {
        if ($roleCodes === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($roleCodes), '?'));
        $statement = $this->db()->prepare(
            "SELECT employee_id, role_code, group_id, is_active, assigned_by, assigned_at
             FROM sats_role_assignments
             WHERE role_code IN ($placeholders)
             ORDER BY role_code, employee_id"
        );
        $statement->execute(array_values($roleCodes));

        $rows = [];
        foreach ($statement->fetchAll() as $row) {
            $rows[] = $this->mapAssignment($row);
        }

        return $rows;
    }

    /**
     * Insert or change one assignment and write the audit row in the same transaction.
     * Refuses to deactivate the last active administrator.
     *
     * @return array<string, mixed>
     */
    public function saveAssignment(
        string $actorId,
        string $employeeId,
        string $roleCode,
        bool $active,
        ?string $groupId,
        bool $replaceGroup,
        bool $rejectWhenAlreadyActive,
    ): array {
        $pdo = $this->db();
        $pdo->beginTransaction();
        try {
            $existing = $this->lockAssignment($pdo, $employeeId, $roleCode);
            $wasActive = $existing !== null && (int) $existing['is_active'] === 1;
            $previousGroup = $existing === null || $existing['group_id'] === null
                ? null
                : (string) $existing['group_id'];
            $nextGroup = $replaceGroup ? $groupId : $previousGroup;
            if ($rejectWhenAlreadyActive && $wasActive && $active) {
                throw new HttpException('This employee already has this assignment.', 409);
            }

            if ($roleCode === 'ADMIN' && $wasActive && !$active) {
                $statement = $pdo->query(
                    'SELECT employee_id
                     FROM sats_role_assignments
                     WHERE role_code = \'ADMIN\' AND is_active = 1
                     FOR UPDATE'
                );
                $activeAdmins = $statement->fetchAll();
                if (count($activeAdmins) <= 1) {
                    throw new HttpException('The last administrator cannot be removed.', 409);
                }
            }

            $action = $this->actionFor($existing !== null, $wasActive, $active, $previousGroup, $nextGroup);
            if ($action === null) {
                $pdo->commit();

                return $existing === null ? [] : $this->mapAssignment($existing);
            }

            $now = gmdate('Y-m-d H:i:s.u');
            if ($existing === null) {
                $insert = $pdo->prepare(
                    'INSERT INTO sats_role_assignments (
                        employee_id, role_code, group_id, is_active, assigned_by, assigned_at
                     ) VALUES (
                        :employeeId, :roleCode, :groupId, :isActive, :assignedBy, :assignedAt
                     )'
                );
                $insert->execute([
                    'employeeId' => $employeeId,
                    'roleCode' => $roleCode,
                    'groupId' => $nextGroup,
                    'isActive' => $active ? 1 : 0,
                    'assignedBy' => $actorId,
                    'assignedAt' => $now,
                ]);
            } elseif ($active) {
                $update = $pdo->prepare(
                    'UPDATE sats_role_assignments
                     SET group_id = :groupId, is_active = 1, assigned_by = :assignedBy, assigned_at = :assignedAt
                     WHERE employee_id = :employeeId AND role_code = :roleCode'
                );
                $update->execute([
                    'groupId' => $nextGroup,
                    'assignedBy' => $actorId,
                    'assignedAt' => $now,
                    'employeeId' => $employeeId,
                    'roleCode' => $roleCode,
                ]);
            } else {
                $update = $pdo->prepare(
                    'UPDATE sats_role_assignments
                     SET is_active = 0
                     WHERE employee_id = :employeeId AND role_code = :roleCode'
                );
                $update->execute([
                    'employeeId' => $employeeId,
                    'roleCode' => $roleCode,
                ]);
            }

            $audit = $pdo->prepare(
                'INSERT INTO sats_access_audit (
                    actor_employee_id, target_employee_id, role_code, action,
                    previous_is_active, new_is_active, previous_group_id, new_group_id, created_at
                 ) VALUES (
                    :actorId, :targetId, :roleCode, :action,
                    :previousActive, :newActive, :previousGroupId, :newGroupId, :createdAt
                 )'
            );
            $audit->execute([
                'actorId' => $actorId,
                'targetId' => $employeeId,
                'roleCode' => $roleCode,
                'action' => $action,
                'previousActive' => $existing === null ? null : ((int) $existing['is_active'] === 1 ? 1 : 0),
                'newActive' => $active ? 1 : 0,
                'previousGroupId' => $previousGroup,
                'newGroupId' => $nextGroup,
                'createdAt' => $now,
            ]);

            $saved = $this->lockAssignment($pdo, $employeeId, $roleCode);
            $pdo->commit();

            return $saved === null ? [] : $this->mapAssignment($saved);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lockAssignment(PDO $pdo, string $employeeId, string $roleCode): ?array
    {
        $statement = $pdo->prepare(
            'SELECT employee_id, role_code, group_id, is_active, assigned_by, assigned_at
             FROM sats_role_assignments
             WHERE employee_id = :employeeId AND role_code = :roleCode
             FOR UPDATE'
        );
        $statement->execute([
            'employeeId' => $employeeId,
            'roleCode' => $roleCode,
        ]);
        $row = $statement->fetch();

        return $row === false ? null : $row;
    }

    private function actionFor(
        bool $exists,
        bool $wasActive,
        bool $active,
        ?string $previousGroup,
        ?string $nextGroup,
    ): ?string {
        if (!$exists) {
            return $active ? 'grant' : null;
        }
        if ($wasActive !== $active) {
            return $active ? 'grant' : 'revoke';
        }
        if ($active && $previousGroup !== $nextGroup) {
            return 'update';
        }

        return null;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapAssignment(array $row): array
    {
        $assignedAt = (string) $row['assigned_at'];
        $stamp = str_replace(' ', 'T', $assignedAt);

        return [
            'employeeId' => (string) $row['employee_id'],
            'roleCode' => (string) $row['role_code'],
            'groupId' => $row['group_id'] === null || $row['group_id'] === ''
                ? null
                : (string) $row['group_id'],
            'active' => (int) $row['is_active'] === 1,
            'assignedBy' => $row['assigned_by'] === null ? null : (string) $row['assigned_by'],
            'assignedAt' => str_ends_with($stamp, 'Z') ? $stamp : $stamp . 'Z',
        ];
    }

    private function db(): PDO
    {
        return Database::sats();
    }
}
