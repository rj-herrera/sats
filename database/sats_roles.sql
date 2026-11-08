-- SATS role catalogue and assignments.
-- Does not copy employees. employee_id is the decimal string of employee_list.id.
-- Active employees are granted APPROVER at the end of this file when their
-- directory designation has section = 1, or designation id 10 or 21.
-- Employee 520 is granted ADMIN. Existing role rows are left unchanged.

CREATE DATABASE IF NOT EXISTS sats
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sats;

CREATE TABLE IF NOT EXISTS sats_roles (
  role_code VARCHAR(32) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sats_role_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id VARCHAR(64) NOT NULL,
  role_code VARCHAR(32) NOT NULL,
  group_id VARCHAR(64) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  assigned_by VARCHAR(64) NULL,
  assigned_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_role (employee_id, role_code),
  CONSTRAINT fk_sats_role_code
    FOREIGN KEY (role_code) REFERENCES sats_roles (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO sats_roles (role_code, role_name, is_active)
VALUES
  ('ADMIN', 'Administrator', 1),
  ('APPROVER', 'Approver', 1),
  ('GROUP_MANAGER', 'Group template manager', 1)
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  is_active = VALUES(is_active);

-- Existing databases created before group_id. Safe to re-run.
SET @sats_role_group_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sats_role_assignments'
    AND COLUMN_NAME = 'group_id'
);
SET @sats_role_group_sql := IF(
  @sats_role_group_column = 0,
  'ALTER TABLE sats_role_assignments ADD COLUMN group_id VARCHAR(64) NULL AFTER role_code',
  'SELECT 1'
);
PREPARE sats_role_group_stmt FROM @sats_role_group_sql;
EXECUTE sats_role_group_stmt;
DEALLOCATE PREPARE sats_role_group_stmt;

CREATE TABLE IF NOT EXISTS sats_access_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_employee_id VARCHAR(64) NOT NULL,
  target_employee_id VARCHAR(64) NOT NULL,
  role_code VARCHAR(32) NOT NULL,
  action VARCHAR(16) NOT NULL,
  previous_is_active TINYINT(1) NULL,
  new_is_active TINYINT(1) NOT NULL,
  previous_group_id VARCHAR(64) NULL,
  new_group_id VARCHAR(64) NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_access_audit_target (target_employee_id, created_at),
  CONSTRAINT fk_access_audit_role
    FOREIGN KEY (role_code) REFERENCES sats_roles (role_code),
  CONSTRAINT chk_access_audit_action CHECK (action IN ('grant', 'revoke', 'update'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Approvers from the company directory.
-- designation_list.section = 1 covers supervisor through executive titles.
-- designation_list.id 10 (CAD Supervisor) and 21 (Senior Software Supervisor)
-- are included even though their section is not 1.
-- Only current employees (emp_status = 1) are granted. Inactive employees stay out
-- of the approver list. Rows already present, including manual grants and removals,
-- are not inserted again and are not reactivated.
-- kdtphdb_new is the directory database (DB_NAME). Re-running this file is safe.
INSERT INTO sats_access_audit (
  actor_employee_id, target_employee_id, role_code, action,
  previous_is_active, new_is_active, previous_group_id, new_group_id, created_at
)
SELECT
  'system',
  CAST(e.id AS CHAR),
  'APPROVER',
  'grant',
  NULL,
  1,
  NULL,
  NULL,
  UTC_TIMESTAMP(6)
FROM kdtphdb_new.employee_list e
INNER JOIN kdtphdb_new.designation_list d ON d.id = e.designation
WHERE (d.section = 1 OR d.id IN (10, 21))
  AND e.emp_status = 1
  AND NOT EXISTS (
    SELECT 1
    FROM sats_role_assignments existing
    WHERE existing.employee_id = CAST(e.id AS CHAR) COLLATE utf8mb4_unicode_ci
      AND existing.role_code = 'APPROVER'
  );

INSERT INTO sats_role_assignments (
  employee_id, role_code, group_id, is_active, assigned_by, assigned_at
)
SELECT
  CAST(e.id AS CHAR),
  'APPROVER',
  NULL,
  1,
  'system',
  UTC_TIMESTAMP(6)
FROM kdtphdb_new.employee_list e
INNER JOIN kdtphdb_new.designation_list d ON d.id = e.designation
WHERE (d.section = 1 OR d.id IN (10, 21))
  AND e.emp_status = 1
  AND NOT EXISTS (
    SELECT 1
    FROM sats_role_assignments existing
    WHERE existing.employee_id = CAST(e.id AS CHAR) COLLATE utf8mb4_unicode_ci
      AND existing.role_code = 'APPROVER'
  );

-- Bootstrap administrator: employee_list.id 520.
-- Skipped when that employee is inactive or an ADMIN row already exists.
INSERT INTO sats_access_audit (
  actor_employee_id, target_employee_id, role_code, action,
  previous_is_active, new_is_active, previous_group_id, new_group_id, created_at
)
SELECT
  'system',
  '520',
  'ADMIN',
  'grant',
  NULL,
  1,
  NULL,
  NULL,
  UTC_TIMESTAMP(6)
FROM kdtphdb_new.employee_list e
WHERE e.id = 520
  AND e.emp_status = 1
  AND NOT EXISTS (
    SELECT 1
    FROM sats_role_assignments existing
    WHERE existing.employee_id = '520'
      AND existing.role_code = 'ADMIN'
  );

INSERT INTO sats_role_assignments (
  employee_id, role_code, group_id, is_active, assigned_by, assigned_at
)
SELECT
  '520',
  'ADMIN',
  NULL,
  1,
  'system',
  UTC_TIMESTAMP(6)
FROM kdtphdb_new.employee_list e
WHERE e.id = 520
  AND e.emp_status = 1
  AND NOT EXISTS (
    SELECT 1
    FROM sats_role_assignments existing
    WHERE existing.employee_id = '520'
      AND existing.role_code = 'ADMIN'
  );
