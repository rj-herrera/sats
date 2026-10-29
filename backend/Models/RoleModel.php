<?php

declare(strict_types=1);

namespace App\Models;

use App\Database;
use PDO;

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

    private function db(): PDO
    {
        return Database::sats();
    }
}
