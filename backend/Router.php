<?php

declare(strict_types=1);

namespace App;

use App\Controllers\DirectoryController;
use App\Controllers\RequestController;
use App\Controllers\TemplateController;

final class Router
{
    public function __construct(
        private readonly DirectoryController $directory,
        private readonly TemplateController $templates,
        private readonly RequestController $requests,
        private readonly DevLogin $devLogin,
    ) {
    }

    public function dispatch(string $method, string $path): void
    {
        if ($method === 'OPTIONS') {
            http_response_code(204);
            return;
        }

        if ($method === 'GET' && $path === '/') {
            json_response([
                'service' => 'sats-directory',
                'endpoints' => [
                    '/groups',
                    '/groups/{id}',
                    '/employees',
                    '/employees?groupId={id}',
                    '/employees/{id}',
                    '/me',
                    '/templates?view=available',
                    '/templates?view=manageable',
                    '/templates/{id}',
                    '/requests?view=mine',
                    '/requests?view=inbox',
                    '/requests?view=completed',
                    '/requests/{id}',
                ],
            ]);
            return;
        }

        if ($path === '/templates' && $method === 'GET') {
            $this->templates->index();
            return;
        }

        if ($path === '/templates' && $method === 'POST') {
            $this->templates->create();
            return;
        }

        if (preg_match('#^/templates/(\d+)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];
            if ($method === 'GET') {
                $this->templates->show($id);
                return;
            }
            if ($method === 'PUT') {
                $this->templates->update($id);
                return;
            }
            json_response(['error' => 'Method not allowed.'], 405);
            return;
        }

        // TESTING ONLY. Remove with backend/DevLogin.php.
        if ($path === '/dev/sign-in' && $method === 'POST') {
            $this->devLogin->signIn();
            return;
        }

        if ($path === '/dev/sign-out' && $method === 'POST') {
            $this->devLogin->signOut();
            return;
        }

        if ($path === '/requests' && $method === 'GET') {
            $this->requests->index();
            return;
        }

        if ($path === '/requests' && $method === 'POST') {
            $this->requests->create();
            return;
        }

        if (preg_match('#^/requests/(\d+)/decisions$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                $this->requests->decide((int) $matches[1]);
                return;
            }
            json_response(['error' => 'Method not allowed.'], 405);
            return;
        }

        if (preg_match('#^/requests/(\d+)/resubmit$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                $this->requests->resubmit((int) $matches[1]);
                return;
            }
            json_response(['error' => 'Method not allowed.'], 405);
            return;
        }

        if (preg_match('#^/requests/(\d+)/cancel$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                $this->requests->cancel((int) $matches[1]);
                return;
            }
            json_response(['error' => 'Method not allowed.'], 405);
            return;
        }

        if (preg_match('#^/requests/(\d+)$#', $path, $matches) === 1) {
            if ($method === 'GET') {
                $this->requests->show((int) $matches[1]);
                return;
            }
            json_response(['error' => 'Method not allowed.'], 405);
            return;
        }

        if ($method !== 'GET') {
            json_response(['error' => 'Method not allowed.'], 405);
            return;
        }

        if ($path === '/me') {
            $this->directory->me();
            return;
        }

        if ($path === '/groups') {
            $this->directory->groups();
            return;
        }

        if (preg_match('#^/groups/(\d+)$#', $path, $matches) === 1) {
            $this->directory->group((int) $matches[1]);
            return;
        }

        if ($path === '/employees') {
            $this->directory->employees();
            return;
        }

        if (preg_match('#^/employees/(\d+)$#', $path, $matches) === 1) {
            $this->directory->employee((int) $matches[1]);
            return;
        }

        json_response(['error' => 'Not found.'], 404);
    }
}
