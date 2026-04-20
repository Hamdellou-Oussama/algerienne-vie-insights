"""Backend runtime settings."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path

from src.config import ROOT


@dataclass(frozen=True)
class BackendSettings:
    """Configuration values for the FastAPI backend."""

    storage_root: Path
    db_path: Path
    upload_max_bytes: int
    access_token_ttl_minutes: int
    refresh_token_ttl_days: int
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "BackendSettings":
        """Build backend settings from environment variables."""

        storage_root = Path(os.getenv("OPEN_DATA_STORAGE_ROOT", str(ROOT / "storage")))
        db_path = Path(os.getenv("OPEN_DATA_DB_PATH", str(storage_root / "backend.sqlite3")))
        upload_max_bytes = int(os.getenv("OPEN_DATA_UPLOAD_MAX_BYTES", str(15 * 1024 * 1024)))
        access_token_ttl_minutes = int(os.getenv("OPEN_DATA_ACCESS_TOKEN_TTL_MINUTES", "30"))
        refresh_token_ttl_days = int(os.getenv("OPEN_DATA_REFRESH_TOKEN_TTL_DAYS", "7"))
        cors_origins_raw = os.getenv(
            "OPEN_DATA_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        )
        cors_origins = tuple(origin.strip() for origin in cors_origins_raw.split(",") if origin.strip())
        return cls(
            storage_root=storage_root,
            db_path=db_path,
            upload_max_bytes=upload_max_bytes,
            access_token_ttl_minutes=access_token_ttl_minutes,
            refresh_token_ttl_days=refresh_token_ttl_days,
            cors_origins=cors_origins,
        )
