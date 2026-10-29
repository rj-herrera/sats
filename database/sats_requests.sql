-- Requests, revisions, assignments, decisions, and activity.
-- Employee ids are the decimal strings of employee_list.id.
-- Run after database/sats_templates.sql.

USE sats;

CREATE TABLE IF NOT EXISTS request_number_sequences (
  year SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_number VARCHAR(32) NOT NULL,
  template_id BIGINT UNSIGNED NOT NULL,
  template_version_id BIGINT UNSIGNED NOT NULL,
  requester_employee_id VARCHAR(64) NOT NULL,
  requester_name_snapshot VARCHAR(200) NOT NULL,
  group_id_snapshot VARCHAR(64) NOT NULL,
  group_name_snapshot VARCHAR(200) NOT NULL,
  department_id_snapshot VARCHAR(64) NULL,
  department_name_snapshot VARCHAR(200) NULL,
  status VARCHAR(16) NOT NULL,
  current_revision_number INT UNSIGNED NOT NULL,
  row_version INT UNSIGNED NOT NULL,
  submitted_at DATETIME(6) NOT NULL,
  last_resubmitted_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL,
  cancelled_by VARCHAR(64) NULL,
  cancelled_by_name VARCHAR(200) NULL,
  cancelled_at DATETIME(6) NULL,
  cancellation_reason TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requests_number (request_number),
  KEY idx_requests_requester (requester_employee_id, submitted_at),
  KEY idx_requests_status (status, updated_at),
  CONSTRAINT fk_requests_template
    FOREIGN KEY (template_id) REFERENCES templates (id),
  CONSTRAINT fk_requests_template_version
    FOREIGN KEY (template_version_id) REFERENCES template_versions (id),
  CONSTRAINT chk_requests_status CHECK (
    status IN ('Pending', 'Approved', 'Rejected', 'Returned', 'Cancelled')
  ),
  CONSTRAINT chk_requests_revision CHECK (current_revision_number >= 1),
  CONSTRAINT chk_requests_row_version CHECK (row_version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS request_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  revision_number INT UNSIGNED NOT NULL,
  template_version_id BIGINT UNSIGNED NOT NULL,
  template_name_snapshot VARCHAR(200) NOT NULL,
  workflow_type VARCHAR(32) NOT NULL,
  field_definitions_json JSON NOT NULL,
  field_values_json JSON NOT NULL,
  workflow_snapshot_json JSON NOT NULL,
  attachments_json JSON NOT NULL,
  submitted_by VARCHAR(64) NOT NULL,
  submitted_by_name VARCHAR(200) NOT NULL,
  submitted_at DATETIME(6) NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  closed_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_request_revision (request_id, revision_number),
  CONSTRAINT fk_request_revisions_request
    FOREIGN KEY (request_id) REFERENCES requests (id),
  CONSTRAINT fk_request_revisions_template_version
    FOREIGN KEY (template_version_id) REFERENCES template_versions (id),
  CONSTRAINT chk_request_revisions_workflow CHECK (
    workflow_type IN ('review_checking', 'hierarchy_approval')
  ),
  CONSTRAINT chk_request_revisions_outcome CHECK (
    outcome IN ('Pending', 'Approved', 'Rejected', 'Returned', 'Cancelled')
  ),
  CONSTRAINT chk_request_revisions_number CHECK (revision_number >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS request_approval_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_revision_id BIGINT UNSIGNED NOT NULL,
  assignment_key VARCHAR(100) NOT NULL,
  step_order SMALLINT UNSIGNED NOT NULL,
  role_label VARCHAR(100) NULL,
  resolved_employee_id VARCHAR(64) NOT NULL,
  employee_name_snapshot VARCHAR(200) NOT NULL,
  group_name_snapshot VARCHAR(200) NOT NULL,
  role_snapshot VARCHAR(16) NOT NULL,
  status VARCHAR(20) NOT NULL,
  activated_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_revision_assignment (request_revision_id, assignment_key),
  KEY idx_assignments_employee (resolved_employee_id, status, request_revision_id),
  CONSTRAINT fk_assignments_revision
    FOREIGN KEY (request_revision_id) REFERENCES request_revisions (id),
  CONSTRAINT chk_assignments_status CHECK (
    status IN ('Waiting', 'Pending', 'Approved', 'Rejected', 'Returned')
  ),
  CONSTRAINT chk_assignments_role CHECK (
    role_snapshot IN ('employee', 'approver', 'admin')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_decisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL,
  decision VARCHAR(16) NOT NULL,
  decided_by VARCHAR(64) NOT NULL,
  remarks TEXT NULL,
  decided_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_decision_assignment (assignment_id),
  CONSTRAINT fk_decisions_assignment
    FOREIGN KEY (assignment_id) REFERENCES request_approval_assignments (id),
  CONSTRAINT chk_decisions_decision CHECK (
    decision IN ('approve', 'reject', 'return')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS request_activity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  request_revision_id BIGINT UNSIGNED NULL,
  revision_number INT UNSIGNED NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  actor_employee_id VARCHAR(64) NOT NULL,
  actor_name_snapshot VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  remarks TEXT NULL,
  related_step_key VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_activity_request (request_id, created_at, id),
  CONSTRAINT fk_activity_request
    FOREIGN KEY (request_id) REFERENCES requests (id),
  CONSTRAINT fk_activity_revision
    FOREIGN KEY (request_revision_id) REFERENCES request_revisions (id),
  CONSTRAINT chk_activity_event CHECK (
    event_type IN (
      'request_submitted',
      'review_completed',
      'review_approved',
      'review_rejected',
      'approval_step_approved',
      'approval_completed',
      'request_approved',
      'request_rejected',
      'request_returned',
      'request_resubmitted',
      'request_cancelled',
      'comment_added'
    )
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
