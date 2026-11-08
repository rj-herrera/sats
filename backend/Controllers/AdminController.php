<?php

declare(strict_types=1);

namespace App\Controllers;

use App\CurrentActor;
use App\HttpException;
use App\Models\EmployeeModel;
use App\Models\RoleModel;

final class AdminController
{
    public function __construct(
        private readonly CurrentActor $actor,
        private readonly EmployeeModel $employees,
        private readonly RoleModel $roles,
    ) {
    }

    public function approvers(): void
    {
        $this->requireAdmin();
        json_response($this->presentMany($this->roles->listAssignments(['APPROVER'])));
    }

    public function grantApprover(): void
    {
        $admin = $this->requireAdmin();
        $employeeId = $this->employeeIdFrom(read_json_body());
        $employee = $this->requireActiveEmployee($employeeId);
        $saved = $this->roles->saveAssignment(
            (string) $admin['id'],
            $employeeId,
            'APPROVER',
            true,
            null,
            true,
            true,
        );
        json_response($this->present($saved, $employee), 201);
    }

    public function updateApprover(string $employeeId): void
    {
        $admin = $this->requireAdmin();
        $this->requireEmployeeId($employeeId);
        $active = $this->activeFrom(read_json_body());
        if ($active) {
            $this->requireActiveEmployee($employeeId);
        }
        $saved = $this->roles->saveAssignment(
            (string) $admin['id'],
            $employeeId,
            'APPROVER',
            $active,
            null,
            false,
            false,
        );
        if ($saved === []) {
            throw new HttpException('Assignment not found.', 404);
        }
        json_response($this->present($saved, $this->employees->find((int) $employeeId)));
    }

    public function access(): void
    {
        $this->requireAdmin();
        json_response($this->presentMany($this->roles->listAssignments(['ADMIN'])));
    }

    public function grantAccess(): void
    {
        $admin = $this->requireAdmin();
        $input = read_json_body();
        $employeeId = $this->employeeIdFrom($input);
        $this->accessRoleFrom($input);
        $employee = $this->requireActiveEmployee($employeeId);
        $saved = $this->roles->saveAssignment(
            (string) $admin['id'],
            $employeeId,
            'ADMIN',
            true,
            null,
            true,
            true,
        );
        json_response($this->present($saved, $employee), 201);
    }

    public function updateAccess(string $employeeId, string $roleCode): void
    {
        $admin = $this->requireAdmin();
        $this->requireEmployeeId($employeeId);
        if ($roleCode !== 'ADMIN') {
            throw new HttpException('roleCode must be ADMIN.', 400);
        }
        $input = read_json_body();
        $active = $this->activeFrom($input);
        $employee = null;
        if ($active) {
            $employee = $this->requireActiveEmployee($employeeId);
        }

        $saved = $this->roles->saveAssignment(
            (string) $admin['id'],
            $employeeId,
            'ADMIN',
            $active,
            null,
            false,
            false,
        );
        if ($saved === []) {
            throw new HttpException('Assignment not found.', 404);
        }
        json_response($this->present($saved, $employee ?? $this->employees->find((int) $employeeId)));
    }

    /** @return array<string, mixed> */
    private function requireAdmin(): array
    {
        $user = $this->actor->requireActive();
        if (!in_array('admin', $user['roles'], true)) {
            throw new HttpException('You do not have permission to manage access.', 403);
        }

        return $user;
    }

    /** @param array<string, mixed> $input */
    private function employeeIdFrom(array $input): string
    {
        $employeeId = $input['employeeId'] ?? null;
        if (!is_string($employeeId) && !is_int($employeeId)) {
            throw new HttpException('employeeId is required.', 400);
        }
        $employeeId = (string) $employeeId;
        $this->requireEmployeeId($employeeId);

        return $employeeId;
    }

    private function requireEmployeeId(string $employeeId): void
    {
        if (preg_match('/^\d+$/', $employeeId) !== 1) {
            throw new HttpException('employeeId is invalid.', 400);
        }
    }

    /** @param array<string, mixed> $input */
    private function accessRoleFrom(array $input): string
    {
        $roleCode = $input['roleCode'] ?? null;
        if ($roleCode !== 'ADMIN') {
            throw new HttpException('roleCode must be ADMIN.', 400);
        }

        return $roleCode;
    }

    /** @param array<string, mixed> $input */
    private function activeFrom(array $input): bool
    {
        $active = $input['active'] ?? null;
        if (!is_bool($active)) {
            throw new HttpException('active must be true or false.', 400);
        }

        return $active;
    }

    /** @return array<string, mixed> */
    private function requireActiveEmployee(string $employeeId): array
    {
        $employee = $this->employees->find((int) $employeeId);
        if ($employee === null) {
            throw new HttpException('Employee not found.', 404);
        }
        if ($employee['status'] !== 'Active') {
            throw new HttpException('This employee is inactive.', 400);
        }

        return $employee;
    }

    /**
     * @param list<array<string, mixed>> $assignments
     * @return list<array<string, mixed>>
     */
    private function presentMany(array $assignments): array
    {
        $presented = [];
        foreach ($assignments as $assignment) {
            $employeeId = (string) $assignment['employeeId'];
            $employee = preg_match('/^\d+$/', $employeeId) === 1
                ? $this->employees->find((int) $employeeId)
                : null;
            $presented[] = $this->present($assignment, $employee);
        }

        return $presented;
    }

    /**
     * @param array<string, mixed> $assignment
     * @param array<string, mixed>|null $employee
     * @return array<string, mixed>
     */
    private function present(array $assignment, ?array $employee): array
    {
        return $assignment + [
            'employeeName' => $employee === null ? '' : (string) $employee['name'],
            'primaryGroupId' => $employee === null || $employee['groupId'] === ''
                ? null
                : (string) $employee['groupId'],
            'primaryGroupName' => $employee === null ? '' : (string) $employee['groupName'],
            'designation' => $employee === null ? '' : (string) ($employee['designation'] ?? ''),
        ];
    }
}
