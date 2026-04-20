"""SQLite helpers for backend metadata persistence."""

from __future__ import annotations

import logging
from pathlib import Path
import sqlite3

LOGGER = logging.getLogger(__name__)


class _ManagedConnection(sqlite3.Connection):
    """SQLite connection that always closes when leaving a context manager."""

    def __exit__(self, exc_type, exc, traceback) -> bool:
        try:
            return super().__exit__(exc_type, exc, traceback)
        finally:
            self.close()


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_account (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS user_session (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    access_token_hash TEXT NOT NULL UNIQUE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    issued_at TEXT NOT NULL,
    access_expires_at TEXT NOT NULL,
    refresh_expires_at TEXT NOT NULL,
    revoked_at TEXT,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES user_account(user_id)
);

CREATE TABLE IF NOT EXISTS document (
    document_id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    current_version_id TEXT,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_version (
    version_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_path_xlsx TEXT NOT NULL,
    storage_path_csv TEXT NOT NULL,
    storage_path_txt TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    FOREIGN KEY(document_id) REFERENCES document(document_id)
);

CREATE TABLE IF NOT EXISTS calculation_run (
    run_id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    document_version_id TEXT NOT NULL,
    parameters_json TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    started_by TEXT NOT NULL,
    result_json TEXT,
    rows_json TEXT,
    error_message TEXT,
    FOREIGN KEY(document_version_id) REFERENCES document_version(version_id)
);

CREATE TABLE IF NOT EXISTS artifact (
    artifact_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    format TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES calculation_run(run_id)
);

CREATE TABLE IF NOT EXISTS audit_event (
    event_id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    payload_json TEXT NOT NULL,
    previous_event_hash TEXT,
    event_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bilan_snapshot (
    snapshot_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    source_runs_json TEXT NOT NULL,
    level3_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_document_domain ON document(domain);
CREATE INDEX IF NOT EXISTS idx_document_version_document ON document_version(document_id);
CREATE INDEX IF NOT EXISTS idx_run_domain_status ON calculation_run(domain, status);
CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_event(occurred_at);
"""


def get_connection(db_path: Path) -> sqlite3.Connection:
    """Return a SQLite connection with dictionary-like rows."""

    connection = sqlite3.connect(db_path, check_same_thread=False, factory=_ManagedConnection)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    return connection


def initialize_database(db_path: Path) -> None:
    """Create metadata tables if they do not yet exist."""

    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        with get_connection(db_path) as connection:
            connection.executescript(SCHEMA_SQL)

            # Backward-compatible migration for existing databases created
            # before level3_json was added to bilan_snapshot.
            columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(bilan_snapshot)").fetchall()
            }
            if "level3_json" not in columns:
                connection.execute("ALTER TABLE bilan_snapshot ADD COLUMN level3_json TEXT")

            connection.commit()
        LOGGER.info("Initialized backend metadata database at %s", db_path)
    except Exception as exc:
        LOGGER.error("Failed to initialize backend database %s: %s", db_path, exc)
        raise
