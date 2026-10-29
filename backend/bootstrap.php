<?php

declare(strict_types=1);

/**
 * Load .env and the directory API classes.
 * Values already present in the environment are kept, so a filled-in
 * server environment is not overwritten by the file.
 */

function load_env(string $path): void
{
    if (!is_file($path)) {
        throw new RuntimeException('Missing .env. Copy .env.example to .env and add the database credentials.');
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        throw new RuntimeException('Could not read .env.');
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $separator = strpos($line, '=');
        if ($separator === false) {
            continue;
        }

        $key = trim(substr($line, 0, $separator));
        $value = trim(substr($line, $separator + 1));
        if ($key === '') {
            continue;
        }

        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"'))
            || (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        $existing = getenv($key);
        if ($existing !== false && $existing !== '') {
            $_ENV[$key] = $existing;
            continue;
        }

        $_ENV[$key] = $value;
        putenv($key . '=' . $value);
    }
}

function env(string $key, string $default = ''): string
{
    $value = $_ENV[$key] ?? getenv($key);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }

    return (string) $value;
}

function request_path(): string
{
    $pathInfo = $_SERVER['PATH_INFO'] ?? '';
    if (is_string($pathInfo) && $pathInfo !== '') {
        return '/' . trim($pathInfo, '/');
    }

    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (!is_string($uri) || $uri === '') {
        return '/';
    }

    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    $scriptDir = rtrim($scriptDir, '/');
    if ($scriptDir !== '' && str_starts_with($uri, $scriptDir)) {
        $uri = substr($uri, strlen($scriptDir));
    }

    $path = '/' . trim($uri, '/');
    return $path === '/' ? '/' : rtrim($path, '/');
}

function json_response(mixed $body, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function send_cors_headers(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ];

    if (!is_string($origin) || !in_array($origin, $allowed, true)) {
        return;
    }

    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

load_env(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/HttpException.php';
require_once __DIR__ . '/RoleProjector.php';
require_once __DIR__ . '/CurrentActor.php';
require_once __DIR__ . '/Models/GroupModel.php';
require_once __DIR__ . '/Models/EmployeeModel.php';
require_once __DIR__ . '/Models/RoleModel.php';
require_once __DIR__ . '/Models/PortalLoginModel.php';
require_once __DIR__ . '/Models/TemplateModel.php';
require_once __DIR__ . '/Models/RequestModel.php';
require_once __DIR__ . '/TemplateValidator.php';
require_once __DIR__ . '/RequestFields.php';
require_once __DIR__ . '/Controllers/DirectoryController.php';
require_once __DIR__ . '/Controllers/TemplateController.php';
require_once __DIR__ . '/Controllers/RequestController.php';
require_once __DIR__ . '/DevLogin.php';
require_once __DIR__ . '/Router.php';

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new App\HttpException('Request body must be JSON.', 400);
    }

    if (!is_array($decoded)) {
        throw new App\HttpException('Request body must be a JSON object.', 400);
    }

    return $decoded;
}
