<?php

declare(strict_types=1);

namespace App\Controllers;

use App\CurrentActor;
use App\HttpException;
use App\Models\TemplateModel;
use App\TemplateValidator;

final class TemplateController
{
    public function __construct(
        private readonly CurrentActor $actor,
        private readonly TemplateModel $templates,
        private readonly TemplateValidator $validator,
    ) {
    }

    public function index(): void
    {
        $user = $this->actor->requireActive();
        $view = $_GET['view'] ?? '';
        if ($view === 'available') {
            json_response($this->templates->listAvailable((string) $user['groupId']));
            return;
        }
        if ($view === 'manageable') {
            json_response($this->templates->listManageable($this->isAdmin($user), (string) $user['groupId']));
            return;
        }

        throw new HttpException('view must be available or manageable.', 400);
    }

    public function show(int $id): void
    {
        $user = $this->actor->requireActive();
        $template = $this->templates->find($id);
        if ($template === null || !$this->canRead($user, $template)) {
            throw new HttpException('Template not found.', 404);
        }

        json_response($template);
    }

    public function create(): void
    {
        $user = $this->actor->requireActive();
        $input = read_json_body();
        $this->restrictNonAdmin($user, $input);
        $template = $this->validator->normalize($input);
        json_response($this->templates->create($template, (string) $user['id']), 201);
    }

    public function update(int $id): void
    {
        $user = $this->actor->requireActive();
        $existing = $this->templates->find($id);
        if ($existing === null || !$this->canManage($user, $existing)) {
            throw new HttpException('Template not found.', 404);
        }

        $input = read_json_body();
        $version = $this->versionFrom($input);
        $this->restrictNonAdmin($user, $input);
        $template = $this->validator->normalize($input);
        json_response($this->templates->update($id, $version, $template, (string) $user['id']));
    }

    /**
     * Approvers stay inside their primary group. Administrators keep the submitted scope.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $input
     */
    private function restrictNonAdmin(array $user, array &$input): void
    {
        if ($this->isAdmin($user)) {
            return;
        }
        if (!$this->isApprover($user)) {
            throw new HttpException('You do not have permission to create templates.', 403);
        }
        if (($input['scope'] ?? '') === 'generic') {
            throw new HttpException('Only an administrator can manage a generic template.', 403);
        }

        $input['scope'] = 'group';
        $input['owningGroupId'] = (string) $user['groupId'];
        $input['allowedGroupIds'] = [(string) $user['groupId']];
    }

    /** @param array<string, mixed> $input */
    private function versionFrom(array $input): int
    {
        $version = $input['version'] ?? null;
        $isPositiveInt = is_int($version) && $version >= 1;
        $isPositiveString = is_string($version) && preg_match('/^\d+$/', $version) === 1 && (int) $version >= 1;
        if (!$isPositiveInt && !$isPositiveString) {
            throw new HttpException('version must be a positive number.', 400);
        }

        return (int) $version;
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $template
     */
    private function canRead(array $user, array $template): bool
    {
        if ($this->canManage($user, $template)) {
            return true;
        }

        if ($template['status'] !== 'Active') {
            return false;
        }

        $groupId = (string) $user['groupId'];
        $allowed = $template['allowedGroupIds'];
        if ($template['scope'] === 'generic') {
            return $allowed === [] || in_array($groupId, $allowed, true);
        }

        return in_array($groupId, $allowed, true);
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $template
     */
    private function canManage(array $user, array $template): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        return $this->isApprover($user)
            && $template['scope'] === 'group'
            && $template['owningGroupId'] === (string) $user['groupId'];
    }

    /** @param array<string, mixed> $user */
    private function isAdmin(array $user): bool
    {
        return in_array('admin', $user['roles'], true);
    }

    /** @param array<string, mixed> $user */
    private function isApprover(array $user): bool
    {
        return in_array('approver', $user['roles'], true);
    }
}
