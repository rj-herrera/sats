<?php

declare(strict_types=1);

namespace App;

/**
 * Maps stored SATS role codes onto the user shape the frontend already uses.
 * An inactive employee never receives approver or admin authority.
 * Template management is not stored: an approver manages templates for the
 * primary group already present on the employee record.
 */
final class RoleProjector
{
    /**
     * @param array<string, mixed> $employee
     * @param list<string> $roleCodes
     * @return array<string, mixed>
     */
    public static function apply(array $employee, array $roleCodes): array
    {
        if (($employee['status'] ?? '') !== 'Active') {
            $employee['roles'] = ['employee'];
            $employee['hasApprovalResponsibility'] = false;

            return $employee;
        }

        $roles = ['employee'];
        if (in_array('APPROVER', $roleCodes, true)) {
            $roles[] = 'approver';
        }
        if (in_array('ADMIN', $roleCodes, true)) {
            $roles[] = 'admin';
        }

        $employee['roles'] = $roles;
        $employee['hasApprovalResponsibility'] = in_array('APPROVER', $roleCodes, true);

        return $employee;
    }
}
