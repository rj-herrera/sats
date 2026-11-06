<?php

declare(strict_types=1);

namespace App;

/**
 * Request files live on disk. The request row stores only the file details.
 */
final class AttachmentStore
{
    public const MAX_FILES = 5;
    public const MAX_BYTES = 20 * 1024 * 1024;

    /** @var array<string, string> */
    private const TYPES = [
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt' => 'application/vnd.ms-powerpoint',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'csv' => 'text/csv',
        'txt' => 'text/plain',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
    ];

    /**
     * Files posted as files[{fieldId}][].
     *
     * @return list<array{fieldId: string, tmp: string, name: string, size: int, extension: string, type: string}>
     */
    public static function incoming(): array
    {
        $bag = $_FILES['files'] ?? null;
        if (!is_array($bag) || !isset($bag['name']) || !is_array($bag['name'])) {
            return [];
        }

        $parsed = [];
        foreach ($bag['name'] as $fieldId => $names) {
            if (!is_string($fieldId) || $fieldId === '' || !is_array($names)) {
                throw new HttpException('A file was uploaded for an unknown field.', 400);
            }
            foreach ($names as $index => $name) {
                $error = $bag['error'][$fieldId][$index] ?? UPLOAD_ERR_NO_FILE;
                if ($error === UPLOAD_ERR_NO_FILE) {
                    continue;
                }
                if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
                    throw new HttpException('Each file must be 20 MB or smaller.', 400);
                }
                if ($error !== UPLOAD_ERR_OK) {
                    throw new HttpException('A file could not be uploaded.', 400);
                }

                $tmp = $bag['tmp_name'][$fieldId][$index] ?? '';
                $size = (int) ($bag['size'][$fieldId][$index] ?? 0);
                if (!is_string($tmp) || !is_uploaded_file($tmp)) {
                    throw new HttpException('A file could not be uploaded.', 400);
                }
                if ($size > self::MAX_BYTES) {
                    throw new HttpException('Each file must be 20 MB or smaller.', 400);
                }

                $extension = self::extension(is_string($name) ? $name : '');
                $parsed[] = [
                    'fieldId' => $fieldId,
                    'tmp' => $tmp,
                    'name' => self::displayName(is_string($name) ? $name : 'file'),
                    'size' => $size,
                    'extension' => $extension,
                    'type' => self::TYPES[$extension],
                ];
            }
        }

        return $parsed;
    }

    /**
     * @param list<array<string, mixed>> $fields
     * @param list<array<string, mixed>> $attachments
     */
    public static function assertForFields(array $fields, array $attachments): void
    {
        $fileFields = [];
        foreach ($fields as $field) {
            if (!is_array($field) || (string) ($field['type'] ?? '') !== 'file') {
                continue;
            }
            $id = (string) ($field['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $fileFields[$id] = trim((string) ($field['label'] ?? 'File')) ?: 'File';
        }

        $counts = [];
        foreach ($attachments as $attachment) {
            $fieldId = (string) ($attachment['fieldId'] ?? '');
            if (!isset($fileFields[$fieldId])) {
                throw new HttpException('A file was uploaded for an unknown field.', 400);
            }
            $counts[$fieldId] = ($counts[$fieldId] ?? 0) + 1;
            if ($counts[$fieldId] > self::MAX_FILES) {
                throw new HttpException($fileFields[$fieldId] . ' can have at most 5 files.', 400);
            }
        }

        foreach ($fileFields as $fieldId => $label) {
            $required = false;
            foreach ($fields as $field) {
                if (is_array($field) && (string) ($field['id'] ?? '') === $fieldId) {
                    $required = (bool) ($field['required'] ?? false);
                    break;
                }
            }
            if ($required && ($counts[$fieldId] ?? 0) === 0) {
                throw new HttpException($label . ' is required.', 400);
            }
        }
    }

    /**
     * @param list<array{fieldId: string, tmp: string, name: string, size: int, extension: string, type: string}> $incoming
     * @return list<array{id: string, fieldId: string, fileName: string, fileSize: int, fileType: string, storedName: string}>
     */
    public function persist(int $requestId, array $incoming): array
    {
        $saved = [];
        try {
            foreach ($incoming as $file) {
                $id = bin2hex(random_bytes(16));
                $storedName = $id . '.' . $file['extension'];
                $directory = $this->directory($requestId);
                if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                    throw new HttpException('The file could not be saved.', 500);
                }
                $path = $directory . DIRECTORY_SEPARATOR . $storedName;
                if (!move_uploaded_file($file['tmp'], $path)) {
                    throw new HttpException('The file could not be saved.', 500);
                }
                $saved[] = [
                    'id' => $id,
                    'fieldId' => $file['fieldId'],
                    'fileName' => $file['name'],
                    'fileSize' => $file['size'],
                    'fileType' => $file['type'],
                    'storedName' => $storedName,
                ];
            }
        } catch (\Throwable $exception) {
            $this->deleteSaved($requestId, $saved);
            throw $exception;
        }

        return $saved;
    }

    /**
     * @param list<array<string, mixed>> $saved
     */
    public function deleteSaved(int $requestId, array $saved): void
    {
        foreach ($saved as $file) {
            $storedName = (string) ($file['storedName'] ?? '');
            if (!self::isStoredName($storedName)) {
                continue;
            }
            $path = $this->directory($requestId) . DIRECTORY_SEPARATOR . $storedName;
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function absolutePath(int $requestId, string $storedName): ?string
    {
        if (!self::isStoredName($storedName)) {
            return null;
        }
        $path = $this->directory($requestId) . DIRECTORY_SEPARATOR . $storedName;
        return is_file($path) ? $path : null;
    }

    public static function isStoredName(string $storedName): bool
    {
        return preg_match('/^[a-f0-9]{32}\.[a-z0-9]{1,5}$/', $storedName) === 1;
    }

    private function directory(int $requestId): string
    {
        return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'attachments'
            . DIRECTORY_SEPARATOR . $requestId;
    }

    private static function extension(string $fileName): string
    {
        $name = strtolower(basename(str_replace('\\', '/', $fileName)));
        $dot = strrpos($name, '.');
        $extension = $dot === false ? '' : substr($name, $dot + 1);
        if (!isset(self::TYPES[$extension])) {
            throw new HttpException(
                'Files must be PDF, Word, Excel, PowerPoint, CSV, text, PNG, or JPEG.',
                400,
            );
        }

        return $extension;
    }

    private static function displayName(string $fileName): string
    {
        $name = basename(str_replace('\\', '/', $fileName));
        $name = preg_replace('/[\x00-\x1F\x7F]/', '', $name) ?? '';
        $name = trim($name);
        if ($name === '' || $name === '.' || $name === '..') {
            $name = 'file';
        }
        if (strlen($name) > 180) {
            $name = substr($name, -180);
        }

        return $name;
    }
}
