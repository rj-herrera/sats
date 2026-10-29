<?php

declare(strict_types=1);

namespace App\Models;

use App\Database;
use PDO;

/**
 * Read-only access to employee_list and employee_group.
 *
 * employee_group.employee_number stores employee_list.id. There is no
 * separate employee-number column, so employeeId is that id.
 * Directory rows default to employee with no approval responsibility.
 * RoleProjector replaces that from sats_role_assignments.
 * groupId is employee_list.group_id. groupIds also includes other rows
 * from employee_group.
 */
final class EmployeeModel
{
    private const SELECT_SQL = <<<'SQL'
        SELECT
            e.id,
            e.firstname,
            e.surname,
            e.email,
            e.group_id,
            e.emp_status,
            e.date_hired,
            g.name AS group_name
        FROM employee_list e
        LEFT JOIN group_list g ON g.id = e.group_id
        SQL;

    private function db(): PDO
    {
        return Database::connection();
    }

    /** @return list<array<string, mixed>> */
    public function all(?int $groupId = null): array
    {
        $sql = self::SELECT_SQL;
        $params = [];

        if ($groupId !== null) {
            $sql .= ' WHERE e.group_id = :groupId
                OR EXISTS (
                    SELECT 1
                    FROM employee_group eg
                    WHERE eg.employee_number = e.id
                      AND eg.group_id = :membershipGroupId
                )';
            $params = [
                'groupId' => $groupId,
                'membershipGroupId' => $groupId,
            ];
        }

        $sql .= ' ORDER BY e.surname, e.firstname, e.id';
        $statement = $this->db()->prepare($sql);
        $statement->execute($params);

        $memberships = $this->membershipsByEmployee();
        $employees = [];
        foreach ($statement->fetchAll() as $row) {
            $id = (int) $row['id'];
            $employees[] = $this->map($row, $memberships[$id] ?? []);
        }

        return $employees;
    }

    /** @return array<string, mixed>|null */
    public function find(int $id): ?array
    {
        $statement = $this->db()->prepare(self::SELECT_SQL . ' WHERE e.id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        return $this->map($row, $this->groupIdsFor((int) $row['id']));
    }

    /**
     * @param list<string> $ids
     * @return array<string, string>
     */
    public function namesByIds(array $ids): array
    {
        $numericIds = [];
        foreach ($ids as $id) {
            if (preg_match('/^\d+$/', $id) === 1) {
                $numericIds[] = (int) $id;
            }
        }
        $numericIds = array_values(array_unique($numericIds));
        if ($numericIds === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($numericIds), '?'));
        $statement = $this->db()->prepare(
            "SELECT id, firstname, surname FROM employee_list WHERE id IN ($placeholders)"
        );
        $statement->execute($numericIds);

        $names = [];
        foreach ($statement->fetchAll() as $row) {
            $name = trim(trim((string) $row['firstname']) . ' ' . trim((string) $row['surname']));
            $names[(string) $row['id']] = $name;
        }

        return $names;
    }

    /** @return array<int, list<string>> */
    private function membershipsByEmployee(): array
    {
        $statement = $this->db()->query(
            'SELECT employee_number, group_id FROM employee_group'
        );

        $memberships = [];
        foreach ($statement->fetchAll() as $row) {
            $employeeId = (int) $row['employee_number'];
            $memberships[$employeeId][] = (string) $row['group_id'];
        }

        return $memberships;
    }

    /** @return list<string> */
    private function groupIdsFor(int $employeeId): array
    {
        $statement = $this->db()->prepare(
            'SELECT group_id
             FROM employee_group
             WHERE employee_number = :employeeId
             ORDER BY group_id'
        );
        $statement->execute(['employeeId' => $employeeId]);

        $groupIds = [];
        foreach ($statement->fetchAll() as $row) {
            $groupIds[] = (string) $row['group_id'];
        }

        return $groupIds;
    }

    /**
     * @param array<string, mixed> $row
     * @param list<string> $memberGroupIds
     * @return array<string, mixed>
     */
    private function map(array $row, array $memberGroupIds): array
    {
        $id = (string) $row['id'];
        $primaryGroupId = $row['group_id'] === null || $row['group_id'] === ''
            ? ''
            : (string) $row['group_id'];

        $groupIds = [];
        if ($primaryGroupId !== '') {
            $groupIds[] = $primaryGroupId;
        }
        foreach ($memberGroupIds as $groupId) {
            if (!in_array($groupId, $groupIds, true)) {
                $groupIds[] = $groupId;
            }
        }

        $hired = trim((string) ($row['date_hired'] ?? ''));
        $timestamp = $hired === '' ? '' : $hired . 'T00:00:00';
        $name = trim(trim((string) $row['firstname']) . ' ' . trim((string) $row['surname']));

        return [
            'id' => $id,
            'employeeId' => $id,
            'name' => $name,
            'email' => trim((string) $row['email']),
            'groupId' => $primaryGroupId,
            'groupName' => trim((string) ($row['group_name'] ?? '')),
            'groupIds' => $groupIds,
            'roles' => ['employee'],
            'hasApprovalResponsibility' => false,
            'status' => (int) $row['emp_status'] === 1 ? 'Active' : 'Inactive',
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
        ];
    }
}
