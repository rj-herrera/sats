<?php

declare(strict_types=1);

namespace App;

/**
 * Maps stored SATS role codes onto the user shape the frontend already uses.
 * An inactive employee never receives approver or admin authority.
 * A designated approver keeps Action Inbox access and manages templates for their primary group.
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
        $employee['managedGroupId'] = null;

        if (($employee['status'] ?? '') !== 'Active') {
            $employee['roles'] = ['employee'];
            $employee['hasApprovalResponsibility'] = false;

            return $employee;
        }

        $roles = ['employee'];
        if (in_array('APPROVER', $roleCodes, true)) {
            $roles[] = 'approver';
            $groupId = trim((string) ($employee['groupId'] ?? ''));
            if ($groupId !== '') {
                $employee['managedGroupId'] = $groupId;
            }
        }
        if (in_array('ADMIN', $roleCodes, true)) {
            $roles[] = 'admin';
        }

        $employee['roles'] = $roles;
        $employee['hasApprovalResponsibility'] = in_array('APPROVER', $roleCodes, true);

        return $employee;
    }
}
