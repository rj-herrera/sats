<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\EmployeeModel;
use App\Models\GroupModel;
use App\Models\PortalLoginModel;
use App\Models\RoleModel;
use App\RoleProjector;

final class DirectoryController
{
    private const LOGIN_URL = 'http://localhost/KDTPortalLogin/';

    public function __construct(
        private readonly GroupModel $groups,
        private readonly EmployeeModel $employees,
        private readonly RoleModel $roles,
        private readonly PortalLoginModel $portalLogin,
    ) {
    }

    public function groups(): void
    {
        json_response($this->groups->all());
    }

    public function group(int $id): void
    {
        $group = $this->groups->find($id);
        if ($group === null) {
            json_response(['error' => 'Group not found.'], 404);
            return;
        }

        json_response($group);
    }

    public function employees(): void
    {
        $groupId = $this->optionalGroupId();
        if ($groupId === false) {
            return;
        }

        json_response($this->withRoles($this->employees->all($groupId)));
    }

    public function employee(int $id): void
    {
        $employee = $this->employees->find($id);
        if ($employee === null) {
            json_response(['error' => 'Employee not found.'], 404);
            return;
        }

        json_response($this->withRoles([$employee])[0]);
    }

    public function me(): void
    {
        $hash = $_COOKIE['userID'] ?? '';
        if (!is_string($hash) || $hash === '') {
            $this->signInRequired();
            return;
        }

        $employeeId = $this->portalLogin->employeeIdForHash($hash);
        if ($employeeId === null) {
            $this->signInRequired();
            return;
        }

        $employee = $this->employees->find($employeeId);
        if ($employee === null) {
            json_response(['error' => 'Employee record is not available.'], 403);
            return;
        }

        if ($employee['status'] !== 'Active') {
            json_response(['error' => 'This employee is inactive.'], 403);
            return;
        }

        json_response($this->withRoles([$employee])[0]);
    }

    private function optionalGroupId(): int|false|null
    {
        if (!isset($_GET['groupId']) || $_GET['groupId'] === '') {
            return null;
        }

        $raw = $_GET['groupId'];
        if (!is_string($raw) || preg_match('/^\d+$/', $raw) !== 1) {
            json_response(['error' => 'groupId must be a number.'], 400);
            return false;
        }

        return (int) $raw;
    }

    /**
     * @param list<array<string, mixed>> $employees
     * @return list<array<string, mixed>>
     */
    private function withRoles(array $employees): array
    {
        $assigned = $this->roles->activeRoleCodesByEmployee();
        $projected = [];
        foreach ($employees as $employee) {
            $employeeId = (string) $employee['id'];
            $projected[] = RoleProjector::apply($employee, $assigned[$employeeId] ?? []);
        }

        return $projected;
    }

    private function signInRequired(): void
    {
        json_response([
            'error' => 'Sign in required.',
            'loginUrl' => self::LOGIN_URL,
        ], 401);
    }
}
