"""Domain enumerations used by preprocessing and validation."""

from __future__ import annotations

from enum import Enum


class DataType(str, Enum):
    """Supported canonical field types."""

    STRING = "string"
    INTEGER = "integer"
    DECIMAL = "decimal"
    DATE = "date"
    CATEGORY = "category"


class CleaningPolicy(str, Enum):
    """Allowed cleaning policies per field."""

    REJECT = "reject"
    COERCE = "coerce"
    IMPUTE_WITH_RULE = "impute_with_rule"
    RETAIN_AND_FLAG = "retain_and_flag"
    MANUAL_REVIEW = "manual_review"


class Severity(str, Enum):
    """Anomaly severity levels."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class RuleCategory(str, Enum):
    """Traceable cleaning and validation rule categories."""

    TYPE_COERCION = "type_coercion"
    DATE_NORMALIZATION = "date_normalization"
    CATEGORICAL_NORMALIZATION = "categorical_normalization"
    DUPLICATE_DETECTION = "duplicate_detection"
    RANGE_VALIDATION = "range_validation"
    BUSINESS_RULE_VALIDATION = "business_rule_validation"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
