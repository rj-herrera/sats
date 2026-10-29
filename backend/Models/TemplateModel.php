<?php

declare(strict_types=1);

namespace App\Models;

use App\Database;
use App\HttpException;
use PDO;
use Throwable;

final class TemplateModel
{
    public function __construct(private readonly EmployeeModel $employees)
    {
    }

    /** @return list<array<string, mixed>> */
    public function listAvailable(string $groupId): array
    {
        if (preg_match('/^\d+$/', $groupId) !== 1) {
            return [];
        }

        $statement = $this->db()->prepare(
            'SELECT t.id
             FROM templates t
             WHERE t.status = \'Active\'
               AND (
                 (
                   t.scope = \'generic\'
                   AND (
                     NOT EXISTS (
                       SELECT 1 FROM template_allowed_groups g WHERE g.template_id = t.id
                     )
                     OR EXISTS (
                       SELECT 1 FROM template_allowed_groups g
                       WHERE g.template_id = t.id AND g.group_id = :genericGroupId
                     )
                   )
                 )
                 OR (
                   t.scope = \'group\'
                   AND EXISTS (
                     SELECT 1 FROM template_allowed_groups g
                     WHERE g.template_id = t.id AND g.group_id = :groupGroupId
                   )
                 )
               )
             ORDER BY t.updated_at DESC, t.id DESC'
        );
        $statement->execute([
            'genericGroupId' => $groupId,
            'groupGroupId' => $groupId,
        ]);

        return $this->hydrateIds($this->idsFrom($statement));
    }

    /** @return list<array<string, mixed>> */
    public function listManageable(bool $isAdmin, string $groupId): array
    {
        if ($isAdmin) {
            $statement = $this->db()->query(
                'SELECT id FROM templates ORDER BY updated_at DESC, id DESC'
            );

            return $this->hydrateIds($this->idsFrom($statement));
        }

        if (preg_match('/^\d+$/', $groupId) !== 1) {
            return [];
        }

        $statement = $this->db()->prepare(
            'SELECT id
             FROM templates
             WHERE scope = \'group\' AND owning_group_id = :groupId
             ORDER BY updated_at DESC, id DESC'
        );
        $statement->execute(['groupId' => $groupId]);

        return $this->hydrateIds($this->idsFrom($statement));
    }

    /** @return array<string, mixed>|null */
    public function find(int $id): ?array
    {
        $hydrated = $this->hydrateIds([$id]);

        return $hydrated[0] ?? null;
    }

    /**
     * Active template the employee's primary group is allowed to submit.
     * A generic template with no allowed-group rows is available to every group.
     *
     * @return array<string, mixed>|null
     */
    public function findAvailable(int $id, string $groupId): ?array
    {
        if ($id < 1 || preg_match('/^\d+$/', $groupId) !== 1) {
            return null;
        }

        $statement = $this->db()->prepare(
            'SELECT t.id
             FROM templates t
             WHERE t.id = :templateId
               AND t.status = \'Active\'
               AND (
                 (
                   t.scope = \'generic\'
                   AND (
                     NOT EXISTS (
                       SELECT 1 FROM template_allowed_groups g WHERE g.template_id = t.id
                     )
                     OR EXISTS (
                       SELECT 1 FROM template_allowed_groups g
                       WHERE g.template_id = t.id AND g.group_id = :genericGroupId
                     )
                   )
                 )
                 OR (
                   t.scope = \'group\'
                   AND EXISTS (
                     SELECT 1 FROM template_allowed_groups g
                     WHERE g.template_id = t.id AND g.group_id = :groupGroupId
                   )
                 )
               )'
        );
        $statement->execute([
            'templateId' => $id,
            'genericGroupId' => $groupId,
            'groupGroupId' => $groupId,
        ]);

        return $this->idsFrom($statement) === [] ? null : $this->find($id);
    }

    /**
     * @param array{
     *   name: string,
     *   description: string,
     *   scope: string,
     *   owningGroupId: string|null,
     *   allowedGroupIds: list<string>,
     *   status: string,
     *   fields: list<array<string, mixed>>,
     *   workflow: array<string, mixed>,
     *   workflowType: string
     * } $template
     * @return array<string, mixed>
     */
    public function create(array $template, string $actorId): array
    {
        $pdo = $this->db();
        $now = $this->now();
        $pdo->beginTransaction();
        try {
            $insert = $pdo->prepare(
                'INSERT INTO templates (
                    name, description, scope, owning_group_id, status,
                    current_version_number, workflow_type, created_by, created_at, updated_by, updated_at
                 ) VALUES (
                    :name, :description, :scope, :owningGroupId, :status,
                    1, :workflowType, :createdBy, :createdAt, :updatedBy, :updatedAt
                 )'
            );
            $insert->execute([
                'name' => $template['name'],
                'description' => $template['description'],
                'scope' => $template['scope'],
                'owningGroupId' => $template['owningGroupId'],
                'status' => $template['status'],
                'workflowType' => $template['workflowType'],
                'createdBy' => $actorId,
                'createdAt' => $now,
                'updatedBy' => $actorId,
                'updatedAt' => $now,
            ]);
            $id = (int) $pdo->lastInsertId();
            $this->insertVersion($pdo, $id, 1, $template, $actorId, $now);
            $this->replaceGroups($pdo, $id, $template['allowedGroupIds'], $actorId, $now);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        $saved = $this->find($id);
        if ($saved === null) {
            throw new HttpException('Template could not be saved.', 500);
        }

        return $saved;
    }

    /**
     * @param array{
     *   name: string,
     *   description: string,
     *   scope: string,
     *   owningGroupId: string|null,
     *   allowedGroupIds: list<string>,
     *   status: string,
     *   fields: list<array<string, mixed>>,
     *   workflow: array<string, mixed>,
     *   workflowType: string
     * } $template
     * @return array<string, mixed>
     */
    public function update(int $id, int $expectedVersion, array $template, string $actorId): array
    {
        $pdo = $this->db();
        $now = $this->now();
        $pdo->beginTransaction();
        try {
            $current = $this->lock($pdo, $id);
            if ((int) $current['current_version_number'] !== $expectedVersion) {
                throw new HttpException('This template was updated by someone else. Reload and try again.', 409);
            }

            $version = $this->versionRow($pdo, $id, $expectedVersion);
            $contentChanged = $this->contentKey($template) !== $this->contentKey([
                'name' => (string) $version['name'],
                'description' => (string) ($version['description'] ?? ''),
                'fields' => $this->decodeJson($version['fields_json']),
                'workflow' => $this->decodeJson($version['workflow_json']),
            ]);
            $nextVersion = $expectedVersion;
            if ($contentChanged) {
                $nextVersion++;
                $this->insertVersion($pdo, $id, $nextVersion, $template, $actorId, $now);
            }

            $update = $pdo->prepare(
                'UPDATE templates
                 SET name = :name,
                     description = :description,
                     scope = :scope,
                     owning_group_id = :owningGroupId,
                     status = :status,
                     current_version_number = :version,
                     workflow_type = :workflowType,
                     updated_by = :actorId,
                     updated_at = :updatedAt
                 WHERE id = :id'
            );
            $update->execute([
                'name' => $contentChanged ? $template['name'] : $current['name'],
                'description' => $contentChanged ? $template['description'] : $current['description'],
                'scope' => $template['scope'],
                'owningGroupId' => $template['owningGroupId'],
                'status' => $template['status'],
                'version' => $nextVersion,
                'workflowType' => $contentChanged ? $template['workflowType'] : $current['workflow_type'],
                'actorId' => $actorId,
                'updatedAt' => $now,
                'id' => $id,
            ]);
            $this->replaceGroups($pdo, $id, $template['allowedGroupIds'], $actorId, $now);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        $saved = $this->find($id);
        if ($saved === null) {
            throw new HttpException('Template could not be saved.', 500);
        }

        return $saved;
    }

    /** @param array<string, mixed> $template */
    private function contentKey(array $template): string
    {
        return json_encode($this->canonicalize([
            'name' => $template['name'],
            'description' => $template['description'],
            'fields' => $template['fields'],
            'workflow' => $template['workflow'],
        ]), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private function canonicalize(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            return array_map($this->canonicalize(...), $value);
        }

        ksort($value);
        foreach ($value as $key => $item) {
            $value[$key] = $this->canonicalize($item);
        }

        return $value;
    }

    private function db(): PDO
    {
        return Database::sats();
    }

    /** @return array<string, mixed> */
    private function lock(PDO $pdo, int $id): array
    {
        $statement = $pdo->prepare('SELECT * FROM templates WHERE id = :id FOR UPDATE');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new HttpException('Template not found.', 404);
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function versionRow(PDO $pdo, int $templateId, int $version): array
    {
        $statement = $pdo->prepare(
            'SELECT name, description, fields_json, workflow_json
             FROM template_versions
             WHERE template_id = :templateId AND version_number = :version'
        );
        $statement->execute(['templateId' => $templateId, 'version' => $version]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new HttpException('Template version is missing.', 500);
        }

        return $row;
    }

    /** @param array<string, mixed> $template */
    private function insertVersion(PDO $pdo, int $templateId, int $version, array $template, string $actorId, string $now): void
    {
        $statement = $pdo->prepare(
            'INSERT INTO template_versions (
                template_id, version_number, name, description, workflow_type,
                fields_json, workflow_json, created_by, created_at
             ) VALUES (
                :templateId, :version, :name, :description, :workflowType,
                :fields, :workflow, :actorId, :createdAt
             )'
        );
        $statement->execute([
            'templateId' => $templateId,
            'version' => $version,
            'name' => $template['name'],
            'description' => $template['description'],
            'workflowType' => $template['workflowType'],
            'fields' => json_encode($template['fields'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'workflow' => json_encode($template['workflow'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'actorId' => $actorId,
            'createdAt' => $now,
        ]);
    }

    /** @param list<string> $groupIds */
    private function replaceGroups(PDO $pdo, int $templateId, array $groupIds, string $actorId, string $now): void
    {
        $delete = $pdo->prepare('DELETE FROM template_allowed_groups WHERE template_id = :templateId');
        $delete->execute(['templateId' => $templateId]);
        $insert = $pdo->prepare(
            'INSERT INTO template_allowed_groups (template_id, group_id, granted_by, granted_at)
             VALUES (:templateId, :groupId, :actorId, :grantedAt)'
        );
        foreach ($groupIds as $groupId) {
            $insert->execute([
                'templateId' => $templateId,
                'groupId' => $groupId,
                'actorId' => $actorId,
                'grantedAt' => $now,
            ]);
        }
    }

    /**
     * @param list<int> $ids
     * @return list<array<string, mixed>>
     */
    private function hydrateIds(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $statement = $this->db()->prepare(
            "SELECT t.*, v.name AS version_name, v.description AS version_description,
                    v.fields_json, v.workflow_json
             FROM templates t
             INNER JOIN template_versions v
               ON v.template_id = t.id AND v.version_number = t.current_version_number
             WHERE t.id IN ($placeholders)"
        );
        $statement->execute($ids);
        $rows = [];
        foreach ($statement->fetchAll() as $row) {
            $rows[(int) $row['id']] = $row;
        }

        $groupStatement = $this->db()->prepare(
            "SELECT template_id, group_id
             FROM template_allowed_groups
             WHERE template_id IN ($placeholders)
             ORDER BY group_id"
        );
        $groupStatement->execute($ids);
        $groups = [];
        foreach ($groupStatement->fetchAll() as $row) {
            $groups[(int) $row['template_id']][] = (string) $row['group_id'];
        }

        $actorIds = [];
        foreach ($rows as $row) {
            $actorIds[] = (string) $row['created_by'];
            $actorIds[] = (string) $row['updated_by'];
        }
        $names = $this->employees->namesByIds($actorIds);

        $templates = [];
        foreach ($ids as $id) {
            if (!isset($rows[$id])) {
                continue;
            }
            $templates[] = $this->present($rows[$id], $groups[$id] ?? [], $names);
        }

        return $templates;
    }

    /**
     * @param array<string, mixed> $row
     * @param list<string> $allowedGroupIds
     * @param array<string, string> $names
     * @return array<string, mixed>
     */
    private function present(array $row, array $allowedGroupIds, array $names): array
    {
        $createdBy = (string) $row['created_by'];
        $updatedBy = (string) $row['updated_by'];

        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['version_name'],
            'description' => (string) ($row['version_description'] ?? ''),
            'scope' => (string) $row['scope'],
            'owningGroupId' => $row['owning_group_id'] === null ? null : (string) $row['owning_group_id'],
            'allowedGroupIds' => $allowedGroupIds,
            'status' => (string) $row['status'],
            'fields' => $this->decodeJson($row['fields_json']),
            'workflow' => $this->decodeJson($row['workflow_json']),
            'createdAt' => $this->iso((string) $row['created_at']),
            'updatedAt' => $this->iso((string) $row['updated_at']),
            'createdById' => $createdBy,
            'createdByName' => $names[$createdBy] ?? $createdBy,
            'updatedById' => $updatedBy,
            'updatedByName' => $names[$updatedBy] ?? $updatedBy,
            'version' => (int) $row['current_version_number'],
        ];
    }

    /** @return list<int> */
    private function idsFrom(\PDOStatement $statement): array
    {
        $ids = [];
        foreach ($statement->fetchAll() as $row) {
            $ids[] = (int) $row['id'];
        }

        return $ids;
    }

    /** @return array<string, mixed>|list<mixed> */
    private function decodeJson(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        $decoded = json_decode((string) $value, true, 512, JSON_THROW_ON_ERROR);

        return is_array($decoded) ? $decoded : [];
    }

    private function now(): string
    {
        return gmdate('Y-m-d H:i:s.u');
    }

    private function iso(string $value): string
    {
        $stamp = str_replace(' ', 'T', $value);

        return str_ends_with($stamp, 'Z') ? $stamp : $stamp . 'Z';
    }
}
