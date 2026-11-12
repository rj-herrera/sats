<?php

declare(strict_types=1);

/**
 * Checks that .env can open the directory and SATS databases,
 * and that the directory user can see the portal login table.
 *
 * Run from the project root:
 *   C:\xampp\php\php.exe database\check_connections.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/backend/bootstrap.php';

use App\Database;

$failed = false;

$failed = !probe('Directory', static function (): string {
    $pdo = Database::connection();
    $pdo->query('SELECT 1')->fetchColumn();
    $name = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();
    $employees = (int) $pdo->query('SELECT COUNT(*) FROM employee_list')->fetchColumn();

    return $name . ' (' . $employees . ' employees)';
}) || $failed;

$failed = !probe('SATS', static function (): string {
    $pdo = Database::sats();
    $pdo->query('SELECT 1')->fetchColumn();
    $name = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();
    $requests = (int) $pdo->query('SELECT COUNT(*) FROM requests')->fetchColumn();

    return $name . ' (' . $requests . ' requests)';
}) || $failed;

$failed = !probe('Portal login', static function (): string {
    $database = env('LOGIN_DB_NAME', 'kdtphdb');
    if (preg_match('/^[A-Za-z0-9_]+$/', $database) !== 1) {
        throw new RuntimeException('LOGIN_DB_NAME must contain only letters, numbers, and underscores.');
    }

    $count = (int) Database::connection()
        ->query(sprintf('SELECT COUNT(*) FROM `%s`.kdtlogin', $database))
        ->fetchColumn();

    return $database . '.kdtlogin (' . $count . ' rows)';
}) || $failed;

exit($failed ? 1 : 0);

/**
 * @param callable(): string $check
 */
function probe(string $label, callable $check): bool
{
    try {
        echo $label . ': OK — ' . $check() . PHP_EOL;
        return true;
    } catch (Throwable $error) {
        fwrite(STDERR, $label . ': FAILED — ' . $error->getMessage() . PHP_EOL);
        return false;
    }
}
