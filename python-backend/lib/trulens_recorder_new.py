from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from app.config import settings


def _ensure_trulens_dir() -> str:
    """Ensure .trulens directory exists and return absolute path to DB file."""
    # Get absolute path to .trulens directory relative to current working directory
    trulens_dir = Path(".trulens")
    trulens_dir.mkdir(exist_ok=True)
    db_path = trulens_dir / "default.sqlite"
    return str(db_path.absolute())


def _create_session() -> Any:
    from trulens.core import TruSession

    db_path = _ensure_trulens_dir()
    db_url = f"sqlite:///{db_path}"
    print(f"[TruLens Recorder] Creating session with DB: {db_url}")
    return TruSession(database_url=db_url)


def _resolve_instrument() -> Any | None:
    try:
        from trulens.apps.app import instrument as trulens_instrument

        return trulens_instrument
    except Exception:
        return None


def record_trulens_review(payload: dict[str, Any]) -> tuple[bool, str]:
    """Best-effort TruLens recording. Safe to call even if TruLens is not installed."""
    print(f"[TruLens Recorder] Starting record_trulens_review...")
    try:
        from trulens.apps.app import TruApp

        instrument = _resolve_instrument()
        session = _create_session()
    except Exception as exc:
        print(f"[TruLens Recorder] Import failed: {exc}")
        return False, f"trulens_import_failed: {exc}"

    if instrument is None:
        print(f"[TruLens Recorder] Instrument not available")
        return False, "trulens_instrument_unavailable"

    class ReviewApp:
        @instrument
        def record(self, input_payload: dict[str, Any]) -> dict[str, Any]:
            return input_payload

    app = ReviewApp()
    tru_app = TruApp(
        app,
        app_name=settings.trulens_app_name,
        app_version=settings.trulens_app_version,
        feedbacks=[],
    )

    print(
        f"[TruLens Recorder] Recording app={settings.trulens_app_name} "
        f"version={settings.trulens_app_version}"
    )

    with tru_app:
        result = app.record(payload)
        print(f"[TruLens Recorder] App record() executed: {result is not None}")

    try:
        session.flush()
        print(f"[TruLens Recorder] Session flushed successfully")
    except Exception as exc:
        print(f"[TruLens Recorder] Session flush failed: {exc}")

    db_path = _ensure_trulens_dir()
    return (
        True,
        (
            "recorded "
            f"app={settings.trulens_app_name}/{settings.trulens_app_version} "
            f"db={db_path}"
        ),
    )
