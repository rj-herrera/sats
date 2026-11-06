-- Template identity, immutable versions, and group sharing.
-- Group ids are the decimal strings of group_list.id.
-- Run after database/sats_roles.sql.
-- Re-running this file is safe. The statements below also insert the default
-- For Review/Checking template when that shared template is not already present.

USE sats;

CREATE TABLE IF NOT EXISTS templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  scope VARCHAR(16) NOT NULL,
  owning_group_id VARCHAR(64) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'Inactive',
  current_version_number INT UNSIGNED NOT NULL,
  workflow_type VARCHAR(32) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_templates_owner_status (owning_group_id, status),
  CONSTRAINT chk_templates_scope CHECK (scope IN ('generic', 'group')),
  CONSTRAINT chk_templates_status CHECK (status IN ('Active', 'Inactive')),
  CONSTRAINT chk_templates_workflow CHECK (workflow_type IN ('review_checking', 'hierarchy_approval')),
  CONSTRAINT chk_templates_scope_owner CHECK (
    (scope = 'generic' AND owning_group_id IS NULL)
    OR (scope = 'group' AND owning_group_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  workflow_type VARCHAR(32) NOT NULL,
  fields_json JSON NOT NULL,
  workflow_json JSON NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_template_version (template_id, version_number),
  CONSTRAINT fk_template_versions_template
    FOREIGN KEY (template_id) REFERENCES templates (id),
  CONSTRAINT chk_template_versions_workflow CHECK (
    workflow_type IN ('review_checking', 'hierarchy_approval')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_allowed_groups (
  template_id BIGINT UNSIGNED NOT NULL,
  group_id VARCHAR(64) NOT NULL,
  granted_by VARCHAR(64) NOT NULL,
  granted_at DATETIME(6) NOT NULL,
  PRIMARY KEY (template_id, group_id),
  KEY idx_allowed_group (group_id, template_id),
  CONSTRAINT fk_template_allowed_groups_template
    FOREIGN KEY (template_id) REFERENCES templates (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared default template. No allowed-group rows means every group may use it.
-- The author is the earliest active administrator. A deployment with no
-- administrator yet still receives the template.
SET @seed_author := (
  SELECT employee_id
  FROM sats_role_assignments
  WHERE role_code = 'ADMIN' AND is_active = 1
  ORDER BY assigned_at, id
  LIMIT 1
);
SET @seed_author := IFNULL(@seed_author, 'system');
SET @seed_now := UTC_TIMESTAMP(6);

INSERT INTO templates (
  name, description, scope, owning_group_id, status,
  current_version_number, workflow_type, created_by, created_at, updated_by, updated_at
)
SELECT
  'For Review/Checking',
  'Shared template for simple document or work-item review. Available to all groups. You choose one or more reviewers when submitting.',
  'generic',
  NULL,
  'Active',
  1,
  'review_checking',
  @seed_author,
  @seed_now,
  @seed_author,
  @seed_now
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM templates
  WHERE name = 'For Review/Checking' AND scope = 'generic'
);

INSERT INTO template_versions (
  template_id, version_number, name, description, workflow_type,
  fields_json, workflow_json, created_by, created_at
)
SELECT
  t.id,
  1,
  t.name,
  t.description,
  'review_checking',
  JSON_ARRAY(
    JSON_OBJECT(
      'id', 'request_title',
      'label', 'Request Title',
      'type', 'text',
      'required', TRUE,
      'placeholder', 'Short title for this request',
      'maxLength', 120
    ),
    JSON_OBJECT(
      'id', 'description',
      'label', 'Description / Details',
      'type', 'textarea',
      'required', TRUE,
      'placeholder', 'Describe what needs to be reviewed',
      'maxLength', 2000
    ),
    JSON_OBJECT(
      'id', 'attachment',
      'label', 'Attachment',
      'type', 'file',
      'required', FALSE
    )
  ),
  JSON_OBJECT('type', 'review_checking'),
  t.created_by,
  t.created_at
FROM templates t
WHERE t.name = 'For Review/Checking'
  AND t.scope = 'generic'
  AND NOT EXISTS (
    SELECT 1
    FROM template_versions v
    WHERE v.template_id = t.id AND v.version_number = 1
  );
