<?php

declare(strict_types=1);

namespace App;

use RuntimeException;

final class HttpException extends RuntimeException
{
    /**
     * @param array<string, mixed> $extra
     */
    public function __construct(
        string $message,
        private readonly int $status,
        private readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }

    /** @return array<string, mixed> */
    public function body(): array
    {
        return ['error' => $this->getMessage()] + $this->extra;
    }
}
