"""Triangle loader placeholder for future real IBNR datasets."""

from __future__ import annotations

import logging

LOGGER = logging.getLogger(__name__)


def triangle_loader_status() -> dict[str, str]:
    """Return the current triangle loader status without fabricating production data."""

    LOGGER.warning("IBNR production dataset is not available; triangle loader remains blocked.")
    return {
        "status": "blocked",
        "reason": "No real IBNR triangle workbook is currently present in data/.",
        "validation_level": "synthetic-only validated",
    }
