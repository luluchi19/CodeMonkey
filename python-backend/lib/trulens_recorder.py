from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.config import settings


METRIC_NAMES = [
    "groundedness",
    "relevance",
    "contextRelevance",
    "actionability",
    "falsePositiveRisk",
    "readability",
    "brevity",
    "coverage",
    "honestHelpful",
]

METRIC_LABELS = {
    "groundedness": "Groundedness / Độ bám ngữ cảnh",
    "relevance": "Relevance / Độ liên quan",
    "contextRelevance": "Context relevance / Liên quan ngữ cảnh",
    "actionability": "Actionability / Tính khả thi",
    "falsePositiveRisk": "False positive risk / Rủi ro sai",
    "readability": "Readability / Dễ đọc",
    "brevity": "Brevity / Ngắn gọn",
    "coverage": "Coverage / Độ bao phủ",
    "honestHelpful": "Honest helpful / Trung thực & hữu ích",
}


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _metric_higher_is_better(metric: str) -> bool:
    return metric != "falsePositiveRisk"


def _metric_label(metric: str) -> str:
    return METRIC_LABELS.get(metric, metric)


def _ensure_trulens_db_file() -> Path:
    """Ensure .trulens directory exists and return absolute sqlite file path."""
    trulens_dir = Path(".trulens")
    trulens_dir.mkdir(exist_ok=True)
    db_path = (trulens_dir / "default.sqlite").absolute()
    print(f"[TruLens Recorder] TruLens DB path: {db_path}")
    return db_path


def _ensure_trulens_schema(db_url: str) -> None:
    """Boot TruLens session once so schema/migrations are created if needed."""
    from trulens.core import TruSession  # type: ignore[import-not-found]

    _ = TruSession(database_url=db_url)


def _ensure_app(cur: sqlite3.Cursor) -> str:
    cur.execute(
        "SELECT app_id FROM trulens_apps WHERE app_name = ? AND app_version = ? LIMIT 1",
        (settings.trulens_app_name, settings.trulens_app_version),
    )
    row = cur.fetchone()
    if row:
        return str(row[0])

    digest = hashlib.md5(
        f"{settings.trulens_app_name}:{settings.trulens_app_version}".encode("utf-8")
    ).hexdigest()
    app_id = f"app_hash_{digest}"
    app_json = {
        "app_id": app_id,
        "app_name": settings.trulens_app_name,
        "app_version": settings.trulens_app_version,
        "tags": "-",
        "metadata": {},
        "root_class": {
            "name": "ReviewApp",
            "module": {"package_name": "lib", "module_name": "lib.trulens_recorder"},
            "bases": None,
        },
        "feedback_definitions": [],
    }
    cur.execute(
        "INSERT INTO trulens_apps(app_id, app_json, app_name, app_version) VALUES (?, ?, ?, ?)",
        (app_id, json.dumps(app_json), settings.trulens_app_name, settings.trulens_app_version),
    )
    return app_id


def _ensure_feedback_def(cur: sqlite3.Cursor, metric: str) -> str:
    feedback_id = f"feedback_definition_hash_{hashlib.md5(metric.encode('utf-8')).hexdigest()}"
    cur.execute(
        "SELECT feedback_definition_id FROM trulens_feedback_defs WHERE feedback_definition_id = ? LIMIT 1",
        (feedback_id,),
    )
    if cur.fetchone():
        return feedback_id

    feedback_json = {
        "feedback_definition_id": feedback_id,
        "supplied_name": _metric_label(metric),
        "higher_is_better": _metric_higher_is_better(metric),
        "implementation": {
            "module": {"package_name": "lib", "module_name": "lib.trulens_recorder"},
            "name": _metric_label(metric),
            "cls": None,
        },
    }
    cur.execute(
        "INSERT INTO trulens_feedback_defs(feedback_definition_id, feedback_json, run_location) VALUES (?, ?, ?)",
        (feedback_id, json.dumps(feedback_json), None),
    )
    return feedback_id


def _insert_metric_feedbacks(
    cur: sqlite3.Cursor,
    record_id: str,
    scores: dict[str, Any] | None,
    ts: float,
) -> int:
    if not scores:
        return 0

    inserted = 0
    for metric in METRIC_NAMES:
        score = _safe_float(scores.get(metric))
        if score is None:
            continue

        feedback_def_id = _ensure_feedback_def(cur, metric)
        feedback_result_id = f"fb_{uuid.uuid4().hex}"
        cur.execute(
            "INSERT INTO trulens_feedbacks(feedback_result_id, record_id, feedback_definition_id, last_ts, status, error, calls_json, result, name, cost_json, multi_result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                feedback_result_id,
                record_id,
                feedback_def_id,
                ts,
                "completed",
                None,
                json.dumps({"calls": []}),
                score,
                _metric_label(metric),
                json.dumps({}),
                None,
            ),
        )
        inserted += 1

    return inserted


def record_trulens_review(payload: dict[str, Any]) -> tuple[bool, str]:
    """Persist one review run in TruLens-compatible sqlite tables."""
    print("[TruLens Recorder] Starting record_trulens_review()")
    os.environ["TRULENS_OTEL_TRACING"] = "0"
    try:
        db_path = _ensure_trulens_db_file()
        db_url = f"sqlite:///{db_path}"
        _ensure_trulens_schema(db_url)
    except Exception as exc:
        print(f"[TruLens Recorder] Import/session failed: {exc}")
        return False, f"trulens_import_failed: {exc}"

    try:
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        app_id = _ensure_app(cur)

        ts = time.time()
        record_id = f"record_{uuid.uuid4().hex}"
        event_id = f"event_{uuid.uuid4().hex}"
        start_time = datetime.fromtimestamp(ts, UTC)
        end_time = start_time + timedelta(milliseconds=1)

        scores = payload.get("scores")
        score_dict = scores if isinstance(scores, dict) else None
        review_text = payload.get("review", "")
        output = {
            "summary": str(review_text)[:1200],
            "checks": [],
            "scores": score_dict or {},
            "notes": payload.get("notes") or (score_dict or {}).get("notes", ""),
        }
        record_json = {
            "app_id": app_id,
            "input": payload,
            "output": output,
            "meta": {
                "repo": payload.get("repo"),
                "prNumber": payload.get("prNumber"),
                "reviewId": payload.get("reviewId"),
                "model": (score_dict or {}).get("model"),
            },
        }

        cur.execute(
            "INSERT INTO trulens_records(record_id, app_id, input, output, record_json, tags, ts, cost_json, perf_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                record_id,
                app_id,
                json.dumps(payload),
                json.dumps(output),
                json.dumps(record_json),
                json.dumps([]),
                ts,
                json.dumps({}),
                json.dumps(
                    {
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                    }
                ),
            ),
        )

        event_row = {
            "record": record_json,
            "record_attributes": {"record_id": record_id},
            "record_type": "record",
            "resource_attributes": {
                "app_name": settings.trulens_app_name,
                "app_version": settings.trulens_app_version,
            },
        }
        cur.execute(
            "INSERT INTO trulens_events(event_id, record, record_attributes, record_type, resource_attributes, start_timestamp, timestamp, trace) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                event_id,
                json.dumps(event_row),
                json.dumps({"record_id": record_id}),
                "record",
                json.dumps(event_row["resource_attributes"]),
                start_time.isoformat(),
                end_time.isoformat(),
                json.dumps({}),
            ),
        )

        feedback_count = _insert_metric_feedbacks(cur, record_id, score_dict, ts)
        conn.commit()
        conn.close()

        print(
            "[TruLens Recorder] Record inserted",
            {
                "recordId": record_id,
                "feedbackCount": feedback_count,
                "repo": payload.get("repo"),
                "prNumber": payload.get("prNumber"),
            },
        )
    except Exception as exc:
        print(f"[TruLens Recorder] Recording failed: {exc}")
        return False, f"recording_failed: {exc}"

    return (
        True,
        (
            "recorded "
            f"app={settings.trulens_app_name}/{settings.trulens_app_version} "
            f"db={db_url}"
        ),
    )
