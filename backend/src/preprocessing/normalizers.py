"""Normalization utilities for dates, numerics, and categories."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import logging
import math
import re
from typing import Any

LOGGER = logging.getLogger(__name__)

_STRING_DATE_FORMATS: tuple[str, ...] = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%m/%d/%Y",
    "%Y/%m/%d",
    "%d.%m.%Y",
)


def normalize_date(value: Any) -> tuple[str | None, str]:
    """Normalize supported date representations to ISO 8601."""

    try:
        if value in (None, ""):
            return None, "missing_date"
        if isinstance(value, datetime):
            return value.date().isoformat(), "datetime_to_iso"
        if isinstance(value, date):
            return value.isoformat(), "date_to_iso"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            origin = datetime(1899, 12, 30)
            if math.isnan(float(value)):
                return None, "nan_date"
            converted = (origin + timedelta(days=float(value))).date().isoformat()
            return converted, "excel_serial_to_iso"
        if isinstance(value, str):
            candidate = value.strip()
            if not candidate:
                return None, "blank_string_date"
            for fmt in _STRING_DATE_FORMATS:
                try:
                    parsed = datetime.strptime(candidate, fmt)
                    return parsed.date().isoformat(), "string_to_iso"
                except ValueError:
                    continue
            return None, "ambiguous_string_date"
        return None, "unsupported_date_type"
    except Exception as exc:
        LOGGER.error("Date normalization failed for value %r: %s", value, exc)
        raise


def normalize_decimal(value: Any) -> tuple[float | None, str]:
    """Normalize numeric values while preserving sign."""

    try:
        if value in (None, ""):
            return None, "missing_decimal"
        if isinstance(value, bool):
            return None, "boolean_not_numeric"
        if isinstance(value, (int, float)):
            return float(value), "numeric_passthrough"
        if isinstance(value, str):
            candidate = value.strip().replace(" ", "")
            if not candidate:
                return None, "blank_string_decimal"
            if candidate.count(",") == 1 and candidate.count(".") == 0:
                candidate = candidate.replace(",", ".")
            elif candidate.count(",") > 1:
                return None, "unsupported_locale_decimal"
            return float(candidate), "string_to_decimal"
        return None, "unsupported_decimal_type"
    except ValueError:
        return None, "invalid_decimal"
    except Exception as exc:
        LOGGER.error("Decimal normalization failed for value %r: %s", value, exc)
        raise


def normalize_integer(value: Any) -> tuple[int | None, str]:
    """Normalize integer-like values."""

    decimal_value, rule = normalize_decimal(value)
    if decimal_value is None:
        return None, rule
    return int(decimal_value), f"{rule}_to_integer"


def normalize_category(value: Any) -> tuple[str | None, str]:
    """Normalize categories with case and whitespace folding."""

    if value in (None, ""):
        return None, "missing_category"
    normalized = re.sub(r"\s+", " ", str(value).strip()).casefold()
    return normalized, "category_casefold"
