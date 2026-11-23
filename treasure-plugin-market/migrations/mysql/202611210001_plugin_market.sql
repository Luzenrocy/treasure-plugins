-- Treasure Plugin Market · MySQL 8.0+ 初始化脚本
-- 使用前创建数据库：CREATE DATABASE treasure_plugin_market CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- 本脚本会删除并重建本项目所有表，请勿直接用于保留数据的生产库。

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS developer_tokens;
DROP TABLE IF EXISTS plugin_releases;
DROP TABLE IF EXISTS plugins;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  alias VARCHAR(255) NULL,
  display_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role ENUM('user', 'admin', 'operator') NOT NULL DEFAULT 'user',
  status ENUM('active', 'disabled', 'pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY users_email_key (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_settings (
  user_id CHAR(36) PRIMARY KEY,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret TEXT NULL,
  mfa_key TEXT NULL,
  token_ttl_seconds INT NOT NULL DEFAULT 600,
  mfa_keyword TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plugins (
  id CHAR(36) PRIMARY KEY,
  plugin_code VARCHAR(255) NOT NULL,
  alias VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  author VARCHAR(255) NOT NULL,
  icon_url TEXT NULL,
  homepage TEXT NULL,
  categories JSON NOT NULL,
  permissions JSON NOT NULL,
  status ENUM('draft', 'pending_review', 'published', 'disabled', 'deleted') NOT NULL DEFAULT 'pending_review',
  created_by CHAR(36) NOT NULL,
  updated_by CHAR(36) NULL,
  deleted_by CHAR(36) NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- MySQL 的普通 UNIQUE 允许多个 NULL；借由生成列复现 PostgreSQL 的“仅未删除行唯一”。
  active_plugin_code VARCHAR(255) AS (IF(deleted_at IS NULL, plugin_code, NULL)) STORED,
  UNIQUE KEY plugins_active_code_idx (active_plugin_code),
  KEY plugins_status_idx (status, deleted_at),
  CONSTRAINT fk_plugins_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_plugins_updater FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_plugins_deleter FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plugin_releases (
  id CHAR(36) PRIMARY KEY,
  plugin_id CHAR(36) NOT NULL,
  version VARCHAR(64) NOT NULL,
  download_url TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  size_bytes DOUBLE NOT NULL,
  manifest_json JSON NOT NULL,
  min_platform_version VARCHAR(64) NULL,
  changelog TEXT NULL,
  status ENUM('draft', 'pending_review', 'published', 'revoked', 'deleted') NOT NULL DEFAULT 'pending_review',
  submitted_by CHAR(36) NOT NULL,
  reviewed_by CHAR(36) NULL,
  reviewed_at TIMESTAMP NULL,
  published_by CHAR(36) NULL,
  published_at TIMESTAMP NULL,
  deleted_by CHAR(36) NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active_version VARCHAR(64) AS (IF(deleted_at IS NULL, version, NULL)) STORED,
  UNIQUE KEY plugin_releases_active_version_idx (plugin_id, active_version),
  KEY plugin_releases_plugin_idx (plugin_id, created_at),
  CONSTRAINT fk_releases_plugin FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
  CONSTRAINT fk_releases_submitter FOREIGN KEY (submitted_by) REFERENCES users(id),
  CONSTRAINT fk_releases_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id),
  CONSTRAINT fk_releases_publisher FOREIGN KEY (published_by) REFERENCES users(id),
  CONSTRAINT fk_releases_deleter FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE developer_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY developer_tokens_active_idx (token_hash, revoked_at),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tokens_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(255) NOT NULL,
  resource_id CHAR(36) NULL,
  request_id VARCHAR(255) NULL,
  metadata JSON NOT NULL DEFAULT (JSON_OBJECT()),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY audit_logs_created_idx (created_at),
  KEY audit_logs_actor_idx (actor_id, created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE auth_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  aal ENUM('aal1', 'aal2') NOT NULL DEFAULT 'aal1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  KEY auth_sessions_user_id_idx (user_id),
  KEY auth_sessions_expires_at_idx (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始管理员：treasure / 123456。首次登录后请立即修改密码。
INSERT INTO users (id, username, email, role, status, password_hash, password_salt)
VALUES ('00000000-0000-4000-8000-000000000001', 'treasure', 'treasure', 'admin', 'active', 'HzWLr5BLAscDCe5wae9hEsyzn0QgsX6OeFlzUnybX3c', 'dgFgjTOxl7ny-0nhMBz4zg');
INSERT INTO user_settings (user_id, mfa_enabled, token_ttl_seconds)
VALUES ('00000000-0000-4000-8000-000000000001', FALSE, 600);
