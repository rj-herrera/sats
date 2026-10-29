<?php

declare(strict_types=1);

namespace App\Models;

use App\Database;
use PDO;
use RuntimeException;

/** Resolves the portal userID cookie to an employee id. Never reads the password column. */
final class PortalLoginModel
{
    public function employeeIdForHash(string $hash): ?int
    {
        if ($hash === '') {
            return null;
        }

        $database = env('LOGIN_DB_NAME', 'kdtphdb');
        if (preg_match('/^[A-Za-z0-9_]+$/', $database) !== 1) {
            throw new RuntimeException('LOGIN_DB_NAME must contain only letters, numbers, and underscores.');
        }

        $statement = $this->db()->prepare(
            sprintf(
                'SELECT fldEmployeeNum FROM `%s`.kdtlogin WHERE fldUserHash = :hash LIMIT 1',
                $database,
            )
        );
        $statement->execute(['hash' => $hash]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        return (int) $row['fldEmployeeNum'];
    }

    /**
     * TESTING ONLY. Used by backend/DevLogin.php to set the userID cookie.
     * Delete this method when that testing sign-in is removed.
     * Never reads the password column.
     */
    public function userHashForEmployee(int $employeeId): ?string
    {
        if ($employeeId < 1) {
            return null;
        }

        $database = env('LOGIN_DB_NAME', 'kdtphdb');
        if (preg_match('/^[A-Za-z0-9_]+$/', $database) !== 1) {
            throw new RuntimeException('LOGIN_DB_NAME must contain only letters, numbers, and underscores.');
        }

        $statement = $this->db()->prepare(
            sprintf(
                'SELECT fldUserHash FROM `%s`.kdtlogin WHERE fldEmployeeNum = :employeeId AND fldUserHash <> \'\' LIMIT 1',
                $database,
            )
        );
        $statement->execute(['employeeId' => $employeeId]);
        $hash = $statement->fetchColumn();
        if (!is_string($hash) || $hash === '') {
            return null;
        }

        return $hash;
    }

    private function db(): PDO
    {
        return Database::connection();
    }
}
