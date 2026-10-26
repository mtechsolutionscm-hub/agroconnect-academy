-- AgroConnect Academy — schéma MySQL 8 (ou MariaDB 10.6+), lot N1.
-- Appliqué par : npm run db:migrate   (idempotent : CREATE TABLE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(190) NOT NULL,
  name           VARCHAR(100) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('learner','trainer','sales','admin') NOT NULL DEFAULT 'learner',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aca_attempts (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  formation   VARCHAR(40) NOT NULL,
  module      VARCHAR(40) NOT NULL,
  good        SMALLINT UNSIGNED NOT NULL,
  total       SMALLINT UNSIGNED NOT NULL,
  passed      TINYINT(1) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY attempts_user_formation (user_id, formation),
  CONSTRAINT attempts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aca_progress (
  user_id     BIGINT UNSIGNED NOT NULL,
  formation   VARCHAR(40) NOT NULL,
  module      VARCHAR(40) NOT NULL,
  best        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  total       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  passed      TINYINT(1) NOT NULL DEFAULT 0,
  passed_at   DATETIME NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, formation, module),
  CONSTRAINT progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aca_certificates (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code               VARCHAR(40) NOT NULL,
  user_id            BIGINT UNSIGNED NOT NULL,
  formation          VARCHAR(40) NOT NULL,
  module             VARCHAR(40) NOT NULL,
  holder_name        VARCHAR(100) NOT NULL DEFAULT '',
  score              VARCHAR(20) NOT NULL DEFAULT '',
  issued_at          DATETIME NOT NULL,
  status             ENUM('active','revoked') NOT NULL DEFAULT 'active',
  status_reason      VARCHAR(255) NOT NULL DEFAULT '',
  status_changed_at  DATETIME NULL,
  status_changed_by  BIGINT UNSIGNED NULL,
  -- Une seule attestation active par compte, formation et module : garanti par la base
  -- (la colonne vaut NULL pour une attestation annulée, et un index unique accepte plusieurs NULL).
  active_key         VARCHAR(130) GENERATED ALWAYS AS (IF(status = 'active', CONCAT(user_id, '|', formation, '|', module), NULL)) STORED,
  UNIQUE KEY certificates_code (code),
  UNIQUE KEY certificates_one_active (active_key),
  KEY certificates_user (user_id, formation),
  CONSTRAINT certificates_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aca_rate_limits (
  bucket        VARCHAR(190) NOT NULL,
  window_start  INT UNSIGNED NOT NULL,
  hits          INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aca_audit_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NULL,
  action       VARCHAR(40) NOT NULL,
  object_type  VARCHAR(20) NOT NULL DEFAULT '',
  object_id    VARCHAR(64) NOT NULL DEFAULT '',
  details      JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
