"""Validation helpers for preprocessing anomaly classification."""

from __future__ import annotations

from typing import Iterable


def has_nonempty_values(values: Iterable[object]) -> bool:
    """Return True when at least one cell contains data."""

    return any(value not in (None, "") for value in values)


def is_allowed_category(value: str | None, vocabulary: tuple[str, ...]) -> bool:
    """Return True when a normalized category is in the configured vocabulary."""

    if value is None:
        return False
    return value in vocabulary
