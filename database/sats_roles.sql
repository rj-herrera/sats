-- SATS role catalogue and assignments.
-- Does not copy employees. employee_id is the decimal string of employee_list.id.
-- No employees are assigned here.

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
  ('APPROVER', 'Approver', 1)
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  is_active = VALUES(is_active);
