<?php

declare(strict_types=1);

namespace App;

use PDO;
use RuntimeException;

final class Database
{
    private static ?PDO $directory = null;

    private static ?PDO $sats = null;

    public static function connection(): PDO
    {
        if (self::$directory instanceof PDO) {
            return self::$directory;
        }

        $name = env('DB_NAME');
        $user = env('DB_USER');
        if ($name === '' || $user === '') {
            throw new RuntimeException('Set DB_NAME and DB_USER in .env before using the directory API.');
        }

        self::$directory = self::connect(
            env('DB_HOST', '127.0.0.1'),
            env('DB_PORT', '3306'),
            $name,
            $user,
            env('DB_PASS'),
        );

        return self::$directory;
    }

    public static function sats(): PDO
    {
        if (self::$sats instanceof PDO) {
            return self::$sats;
        }

        $name = env('SATS_DB_NAME', 'sats');
        $user = env('SATS_DB_USER');
        $password = env('SATS_DB_PASS');
        if ($user === '') {
            $user = env('DB_USER');
            $password = env('DB_PASS');
        }

        if ($name === '' || $user === '') {
            throw new RuntimeException('Set SATS_DB_NAME in .env before using SATS roles.');
        }

        self::$sats = self::connect(
            env('SATS_DB_HOST', env('DB_HOST', '127.0.0.1')),
            env('SATS_DB_PORT', env('DB_PORT', '3306')),
            $name,
            $user,
            $password,
        );

        return self::$sats;
    }

    private static function connect(
        string $host,
        string $port,
        string $name,
        string $user,
        string $password,
    ): PDO {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);

        return new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
}
