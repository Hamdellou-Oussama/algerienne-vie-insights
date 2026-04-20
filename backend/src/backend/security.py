"""Security helpers for passwords and opaque bearer tokens."""

from __future__ import annotations

from base64 import b64decode, b64encode
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets


def now_utc() -> datetime:
    """Return the current UTC timestamp."""

    return datetime.now(timezone.utc)


def utc_isoformat(value: datetime | None = None) -> str:
    """Return an ISO-8601 UTC timestamp string."""

    return (value or now_utc()).replace(microsecond=0).isoformat()


def hash_password(password: str) -> str:
    """Hash a password using salted scrypt."""

    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"{b64encode(salt).decode('ascii')}${b64encode(digest).decode('ascii')}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against its stored hash."""

    salt_b64, digest_b64 = password_hash.split("$", 1)
    salt = b64decode(salt_b64.encode("ascii"))
    expected = b64decode(digest_b64.encode("ascii"))
    actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(actual, expected)


def hash_token(token: str) -> str:
    """Return the SHA-256 hash of an opaque token."""

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token() -> str:
    """Return a URL-safe opaque token."""

    return secrets.token_urlsafe(32)


def expiry_after_minutes(minutes: int) -> str:
    """Return a future UTC timestamp in minutes."""

    return utc_isoformat(now_utc() + timedelta(minutes=minutes))


def expiry_after_days(days: int) -> str:
    """Return a future UTC timestamp in days."""

    return utc_isoformat(now_utc() + timedelta(days=days))
