<?php

declare(strict_types=1);

namespace App\Models;

use App\Database;
use PDO;

/**
 * Read-only access to group_list.
 * That table has no status or timestamp columns, so every group is Active.
 */
final class GroupModel
{
    private function db(): PDO
    {
        return Database::connection();
    }

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        $statement = $this->db()->query(
            'SELECT id, abbreviation, name
             FROM group_list
             ORDER BY name, id'
        );

        $groups = [];
        foreach ($statement->fetchAll() as $row) {
            $groups[] = $this->map($row);
        }

        return $groups;
    }

    /** @return array<string, mixed>|null */
    public function find(int $id): ?array
    {
        $statement = $this->db()->prepare(
            'SELECT id, abbreviation, name
             FROM group_list
             WHERE id = :id'
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : $this->map($row);
    }

    /**
     * Group name plus department, for the snapshot stored on a request.
     * A dept_id of 0 has no department row, so both department fields stay null.
     *
     * @return array{id: string, name: string, departmentId: string|null, departmentName: string|null}|null
     */
    public function directoryProfile(int $id): ?array
    {
        $statement = $this->db()->prepare(
            'SELECT g.id, g.name, g.dept_id, d.name AS department_name
             FROM group_list g
             LEFT JOIN department_list d ON d.id = g.dept_id AND g.dept_id <> 0
             WHERE g.id = :id'
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        $deptId = (int) $row['dept_id'];
        $deptName = $row['department_name'] === null ? '' : trim((string) $row['department_name']);

        return [
            'id' => (string) $row['id'],
            'name' => trim((string) $row['name']),
            'departmentId' => $deptId > 0 ? (string) $deptId : null,
            'departmentName' => $deptId > 0 && $deptName !== '' ? $deptName : null,
        ];
    }

    /** @param array<string, mixed> $row */
    private function map(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => trim((string) $row['name']),
            'code' => strtoupper(trim((string) $row['abbreviation'])),
            'description' => '',
            'status' => 'Active',
            'createdAt' => '',
            'updatedAt' => '',
        ];
    }
}
