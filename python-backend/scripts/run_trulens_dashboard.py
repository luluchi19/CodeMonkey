from __future__ import annotations

"""
Start TruLens dashboard for local evaluation inspection.

Usage:
  python scripts/run_trulens_dashboard.py
"""

import os
import sys
from pathlib import Path

# Force non-OTEL mode so dashboard shows legacy records inserted locally
# Use assignment to override any existing environment setting.
os.environ["TRULENS_OTEL_TRACING"] = "0"

# Ensure subprocesses (streamlit) are resolvable when running with a venv python.
venv_scripts = str(Path(sys.executable).resolve().parent)
os.environ["PATH"] = venv_scripts + os.pathsep + os.environ.get("PATH", "")

try:
    from trulens.core import TruSession
    from trulens.dashboard import run_dashboard
except Exception as exc:  # pragma: no cover - helper script
    raise SystemExit(
        "TruLens is not installed or import failed. Run: pip install -r requirements.txt\n"
        f"Import error: {exc}"
    )


def main() -> None:
    # Ensure .trulens directory and use absolute path (same as recorder)
    trulens_dir = Path(".trulens")
    trulens_dir.mkdir(exist_ok=True)
    db_path = (trulens_dir / "default.sqlite").absolute()
    db_url = f"sqlite:///{db_path}"
    
    print(f"TruLens dashboard using: {db_url}")
    print(f"Expected app: CodeMonkey Review/v1")
    
    session = TruSession(database_url=db_url)
    run_dashboard(session)


if __name__ == "__main__":
    main()
