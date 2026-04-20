"""Configuration helpers for the actuarial provisioning system."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

LOGGER = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]


def load_yaml_config(relative_path: str) -> dict[str, Any]:
    """Load a YAML config file relative to the repository root."""

    config_path = ROOT / relative_path
    try:
        with config_path.open("r", encoding="utf-8") as handle:
            payload = yaml.safe_load(handle) or {}
        if not isinstance(payload, dict):
            raise ValueError(f"Config {config_path} did not load as a mapping.")
        return payload
    except Exception as exc:
        LOGGER.error("Failed to load config %s: %s", config_path, exc)
        raise
