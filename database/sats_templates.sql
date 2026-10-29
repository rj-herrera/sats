-- Template identity, immutable versions, and group sharing.
-- Group ids are the decimal strings of group_list.id.
-- Run after database/sats_roles.sql.

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
