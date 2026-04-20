"""Run the repository validation suite."""

from __future__ import annotations

import logging
from pathlib import Path
import subprocess
import sys

LOGGER = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    """Run unittest discovery for the project."""

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    command = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-t", ".", "-v"]
    LOGGER.info("Running validation suite: %s", " ".join(command))
    completed = subprocess.run(command, cwd=ROOT, check=False)
    raise SystemExit(completed.returncode)


if __name__ == "__main__":
    main()
