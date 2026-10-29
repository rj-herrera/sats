<?php

declare(strict_types=1);

use App\DevLogin;
use App\Controllers\DirectoryController;
use App\Controllers\RequestController;
use App\Controllers\TemplateController;
use App\CurrentActor;
use App\HttpException;
use App\Models\EmployeeModel;
use App\Models\GroupModel;
use App\Models\PortalLoginModel;
use App\Models\RequestModel;
use App\Models\RoleModel;
use App\Models\TemplateModel;
use App\Router;
use App\TemplateValidator;

require dirname(__DIR__) . '/backend/bootstrap.php';

send_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $portalLogin = new PortalLoginModel();
    $employees = new EmployeeModel();
    $roles = new RoleModel();
    $groups = new GroupModel();
    $actor = new CurrentActor($portalLogin, $employees, $roles);
    $templates = new TemplateModel($employees);
    $router = new Router(
        new DirectoryController($groups, $employees, $roles, $portalLogin),
        new TemplateController($actor, $templates, new TemplateValidator($groups, $employees)),
        new RequestController(
            $actor,
            new RequestModel(),
            $templates,
            $employees,
            $groups,
            $roles,
        ),
        new DevLogin($portalLogin, $employees),
    );
    $router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', request_path());
} catch (HttpException $exception) {
    json_response($exception->body(), $exception->status());
} catch (Throwable $exception) {
    json_response(['error' => $exception->getMessage()], 500);
}
