<?php

declare(strict_types=1);

namespace App;

use App\Models\EmployeeModel;
use App\Models\PortalLoginModel;
use App\Models\RoleModel;

final class CurrentActor
{
    public const LOGIN_URL = 'http://localhost/KDTPortalLogin/';

    public function __construct(
        private readonly PortalLoginModel $portalLogin,
        private readonly EmployeeModel $employees,
        private readonly RoleModel $roles,
    ) {
    }

    /** @return array<string, mixed> */
    public function requireActive(): array
    {
        $hash = $_COOKIE['userID'] ?? '';
        if (!is_string($hash) || $hash === '') {
            throw new HttpException('Sign in required.', 401, ['loginUrl' => self::LOGIN_URL]);
        }

        $employeeId = $this->portalLogin->employeeIdForHash($hash);
        if ($employeeId === null) {
            throw new HttpException('Sign in required.', 401, ['loginUrl' => self::LOGIN_URL]);
        }

        $employee = $this->employees->find($employeeId);
        if ($employee === null) {
            throw new HttpException('Employee record is not available.', 403);
        }

        if ($employee['status'] !== 'Active') {
            throw new HttpException('This employee is inactive.', 403);
        }

        $assigned = $this->roles->activeRoleCodesByEmployee();
        $employeeIdKey = (string) $employee['id'];

        return RoleProjector::apply($employee, $assigned[$employeeIdKey] ?? []);
    }
}
