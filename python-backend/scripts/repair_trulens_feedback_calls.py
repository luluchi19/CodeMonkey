from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path


def main() -> None:
    db = Path(".trulens") / "default.sqlite"
    if not db.exists():
        raise SystemExit(f"Database not found: {db}")

    conn = sqlite3.connect(str(db))
    cur = conn.cursor()

    feedback_rows = list(
        cur.execute(
            "SELECT feedback_result_id, calls_json FROM trulens_feedbacks"
        )
    )

    feedback_updated = 0
    for feedback_result_id, calls_json in feedback_rows:
        normalized = {"calls": []}
        try:
            parsed = json.loads(calls_json) if calls_json else None
            if isinstance(parsed, dict) and "calls" in parsed:
                continue
            if isinstance(parsed, list):
                normalized = {"calls": parsed}
        except Exception:
            normalized = {"calls": []}

        cur.execute(
            "UPDATE trulens_feedbacks SET calls_json = ? WHERE feedback_result_id = ?",
            (json.dumps(normalized), feedback_result_id),
        )
        feedback_updated += 1

    # Older seed rows used perf_json='{}', which breaks Perf model validation.
    record_rows = list(
        cur.execute("SELECT record_id, ts, perf_json FROM trulens_records")
    )
    perf_updated = 0
    for record_id, ts, perf_json in record_rows:
        try:
            parsed = json.loads(perf_json) if perf_json else None
        except Exception:
            parsed = None

        if isinstance(parsed, dict) and parsed.get("start_time") and parsed.get("end_time"):
            continue

        base = datetime.fromtimestamp(float(ts), UTC)
        normalized_perf = {
            "start_time": base.isoformat(),
            "end_time": (base + timedelta(microseconds=1)).isoformat(),
        }
        cur.execute(
            "UPDATE trulens_records SET perf_json = ? WHERE record_id = ?",
            (json.dumps(normalized_perf), record_id),
        )
        perf_updated += 1

    conn.commit()
    conn.close()

    print(f"Updated feedback rows: {feedback_updated}")
    print(f"Updated perf_json rows: {perf_updated}")


if __name__ == "__main__":
    main()
