<?php

declare(strict_types=1);

namespace App;

/**
 * Checks submitted values against the field definitions copied onto a request.
 * File bytes are not accepted in this piece.
 */
final class RequestFields
{
    private const NUMERIC_TYPES = ['number', 'currency_php', 'currency_usd', 'currency_jpy'];

    /**
     * @param list<array<string, mixed>> $fields
     * @param array<mixed> $values
     * @return array<string, mixed>
     */
    public static function normalize(array $fields, array $values): array
    {
        if (array_is_list($values) && $values !== []) {
            throw new HttpException('fieldValues must be an object.', 400);
        }

        $known = [];
        foreach ($fields as $field) {
            if (isset($field['id'])) {
                $known[(string) $field['id']] = true;
            }
        }
        foreach ($values as $key => $unused) {
            if (!isset($known[(string) $key])) {
                throw new HttpException('Unknown field ' . $key . '.', 400);
            }
        }

        $stored = [];
        foreach ($fields as $field) {
            $id = (string) ($field['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $stored[$id] = self::one($field, $values[$id] ?? null);
        }

        return $stored;
    }

    /**
     * True when every stored answer matches the returned revision.
     * File fields are skipped until uploads are stored.
     *
     * @param list<array<string, mixed>> $fields
     * @param array<string, mixed> $previous
     * @param array<string, mixed> $next
     */
    public static function unchanged(array $fields, array $previous, array $next): bool
    {
        foreach ($fields as $field) {
            if (!is_array($field)) {
                continue;
            }
            $id = (string) ($field['id'] ?? '');
            if ($id === '' || (string) ($field['type'] ?? '') === 'file') {
                continue;
            }
            if (!self::sameStored($previous[$id] ?? null, $next[$id] ?? null)) {
                return false;
            }
        }

        return true;
    }

    /** @param array<string, mixed> $field */
    private static function one(array $field, mixed $value): mixed
    {
        $label = trim((string) ($field['label'] ?? 'Field'));
        $type = (string) ($field['type'] ?? 'text');
        $required = (bool) ($field['required'] ?? false);

        if ($type === 'file') {
            if ($required || !self::isBlank($value)) {
                throw new HttpException('File uploads are not available yet.', 400);
            }

            return null;
        }

        if ($type === 'checkbox') {
            if ($value === null) {
                $value = false;
            }
            if (!is_bool($value)) {
                throw new HttpException($label . ' must be checked.', 400);
            }
            if ($required && $value !== true) {
                throw new HttpException($label . ' must be checked.', 400);
            }

            return $value;
        }

        if (self::isBlank($value)) {
            if ($required) {
                throw new HttpException($label . ' is required.', 400);
            }

            return null;
        }

        if (in_array($type, self::NUMERIC_TYPES, true)) {
            return self::number($field, $label, $value);
        }

        if (!is_string($value)) {
            throw new HttpException($label . ' must be text.', 400);
        }

        $text = trim($value);
        if ($text === '') {
            if ($required) {
                throw new HttpException($label . ' is required.', 400);
            }

            return null;
        }

        if (
            ($type === 'text' || $type === 'textarea')
            && isset($field['maxLength'])
            && is_numeric($field['maxLength'])
            && mb_strlen($text) > (int) $field['maxLength']
        ) {
            throw new HttpException($label . ' must be at most ' . $field['maxLength'] . ' characters.', 400);
        }

        if ($type === 'url' && !self::isUrl($text)) {
            throw new HttpException('Enter a valid URL starting with http:// or https://.', 400);
        }

        if ($type === 'select' || $type === 'radio') {
            $allowed = [];
            foreach ($field['options'] ?? [] as $option) {
                if (is_array($option) && isset($option['value'])) {
                    $allowed[] = (string) $option['value'];
                }
            }
            if (!in_array($text, $allowed, true)) {
                throw new HttpException('Select a valid option for ' . $label . '.', 400);
            }
        }

        return $text;
    }

    /** @param array<string, mixed> $field */
    private static function number(array $field, string $label, mixed $value): int|float
    {
        if (is_string($value) && is_numeric($value)) {
            $value += 0;
        }
        if (!is_int($value) && !is_float($value)) {
            throw new HttpException($label . ' must be a number.', 400);
        }

        $number = $value + 0;
        if (isset($field['min']) && is_numeric($field['min']) && $number < $field['min'] + 0) {
            throw new HttpException($label . ' must be at least ' . $field['min'] . '.', 400);
        }
        if (isset($field['max']) && is_numeric($field['max']) && $number > $field['max'] + 0) {
            throw new HttpException($label . ' must be at most ' . $field['max'] . '.', 400);
        }

        if (is_float($number) && floor($number) === $number) {
            return (int) $number;
        }

        return $number;
    }

    private static function sameStored(mixed $left, mixed $right): bool
    {
        if (is_int($left) && is_float($right)) {
            return (float) $left === $right;
        }
        if (is_float($left) && is_int($right)) {
            return $left === (float) $right;
        }

        return $left === $right;
    }

    private static function isBlank(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return trim($value) === '';
        }

        return false;
    }

    private static function isUrl(string $value): bool
    {
        if (filter_var($value, FILTER_VALIDATE_URL) === false) {
            return false;
        }
        $scheme = parse_url($value, PHP_URL_SCHEME);

        return $scheme === 'http' || $scheme === 'https';
    }
}
