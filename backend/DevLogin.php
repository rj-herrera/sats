<?php

declare(strict_types=1);

namespace App;

use App\Models\EmployeeModel;
use App\Models\PortalLoginModel;

/**
 * TESTING ONLY. Local sign-in that writes the portal userID cookie.
 *
 * Delete this file after testing, and also remove:
 * - SATS_DEV_LOGIN from .env and .env.example
 * - the DevLogin require in backend/bootstrap.php
 * - the DevLogin argument in api/index.php
 * - the /dev/sign-in and /dev/sign-out routes in backend/Router.php
 * - userHashForEmployee() in backend/Models/PortalLoginModel.php
 * - frontend/src/components/TestingSignIn.tsx
 * - devSignIn() and devSignOut() in frontend/src/services/accountService.ts
 * - the testing logout menu in frontend/src/layouts/Sidebar.tsx
 */
final class DevLogin
{
    public function __construct(
        private readonly PortalLoginModel $portalLogin,
        private readonly EmployeeModel $employees,
    ) {
    }

    public function signIn(): void
    {
        $this->assertEnabled();
        $input = read_json_body();
        $employeeId = $input['employeeId'] ?? null;
        if (!is_string($employeeId) && !is_int($employeeId)) {
            throw new HttpException('Enter an employee id.', 400);
        }
        if (preg_match('/^\d+$/', (string) $employeeId) !== 1) {
            throw new HttpException('Enter an employee id.', 400);
        }

        $employee = $this->employees->find((int) $employeeId);
        if ($employee === null) {
            throw new HttpException('No employee was found with that id.', 400);
        }
        if ($employee['status'] !== 'Active') {
            throw new HttpException('This employee is inactive.', 400);
        }

        $hash = $this->portalLogin->userHashForEmployee((int) $employeeId);
        if ($hash === null || strpbrk($hash, "\r\n;") !== false) {
            throw new HttpException('No portal login was found for that employee id.', 400);
        }

        $this->writeCookie($hash);
        json_response(['ok' => true]);
    }

    public function signOut(): void
    {
        $this->assertEnabled();
        $this->writeCookie('', true);
        json_response(['ok' => true]);
    }

    private function assertEnabled(): void
    {
        if (env('SATS_DEV_LOGIN') !== '1') {
            throw new HttpException('Not found.', 404);
        }

        $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $host = preg_replace('/:\d+$/', '', $host) ?? '';
        $localHost = $host === 'localhost' || $host === '127.0.0.1';
        $localCaller = $remote === '127.0.0.1' || $remote === '::1';
        if (!$localHost || !$localCaller) {
            throw new HttpException('Not found.', 404);
        }
    }

    private function writeCookie(string $value, bool $expire = false): void
    {
        setcookie('userID', $value, [
            'expires' => $expire ? time() - 3600 : time() + 60 * 60 * 24 * 14,
            'path' => '/',
            'secure' => false,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}
