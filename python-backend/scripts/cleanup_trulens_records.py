from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

SEED_REVIEW_IDS = {
    "local-test-1",
    "sample-backfill-1",
}

SEED_REPOS = {
    "manual-seed",
}

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


def _is_seed_record(record_json_text: str) -> bool:
    try:
        record = json.loads(record_json_text)
    except Exception:
        return False

    if not isinstance(record, dict):
        return False

    record_input = record.get("input")
    if not isinstance(record_input, dict):
        return False

    meta = record.get("meta")
    review_id = record_input.get("reviewId")
    repo = record_input.get("repo")
    title = record_input.get("title")

    if isinstance(meta, dict) and meta.get("seeded") is True:
        return True

    if review_id in SEED_REVIEW_IDS:
        return True

    if repo in SEED_REPOS:
        return True

    if title in {"Seeded record", "Local TruLens metric mapping test"}:
        return True

    return False


def _is_seed_event(event_json_text: str) -> bool:
    try:
        event = json.loads(event_json_text)
    except Exception:
        return False

    if not isinstance(event, dict):
        return False

    record = event.get("record")
    if not isinstance(record, dict):
        return False

    return _is_seed_record(json.dumps(record))


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove local seed/test TruLens rows and localize metric labels.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without modifying the DB.")
    args = parser.parse_args()

    db_path = Path(".trulens") / "default.sqlite"
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    rows = list(cur.execute("SELECT record_id, record_json FROM trulens_records"))
    delete_record_ids: list[str] = []
    for record_id, record_json in rows:
        if _is_seed_record(record_json):
            delete_record_ids.append(str(record_id))

    if args.dry_run:
        print(f"Would delete records: {len(delete_record_ids)}")
        for record_id in delete_record_ids:
            print("  ", record_id)
        conn.close()
        return

    event_rows = list(cur.execute("SELECT event_id, record FROM trulens_events"))
    delete_event_ids = [
        str(event_id)
        for event_id, event_json in event_rows
        if _is_seed_event(event_json)
    ]

    deleted_feedbacks = 0
    deleted_events = 0
    deleted_records = 0

    for record_id in delete_record_ids:
        cur.execute("DELETE FROM trulens_feedbacks WHERE record_id = ?", (record_id,))
        deleted_feedbacks += cur.rowcount if cur.rowcount is not None else 0

        cur.execute("DELETE FROM trulens_records WHERE record_id = ?", (record_id,))
        deleted_records += cur.rowcount if cur.rowcount is not None else 0

    for event_id in delete_event_ids:
        cur.execute("DELETE FROM trulens_events WHERE event_id = ?", (event_id,))
        deleted_events += cur.rowcount if cur.rowcount is not None else 0

    # Rename feedback labels for the remaining metric rows so the dashboard reads cleaner.
    updated_feedbacks = 0
    for metric, label in METRIC_LABELS.items():
        cur.execute(
            "UPDATE trulens_feedbacks SET name = ? WHERE name = ?",
            (label, metric),
        )
        updated_feedbacks += cur.rowcount if cur.rowcount is not None else 0

        cur.execute("SELECT feedback_definition_id, feedback_json FROM trulens_feedback_defs")
        defs = cur.fetchall()
        for feedback_definition_id, feedback_json in defs:
            try:
                payload = json.loads(feedback_json)
            except Exception:
                continue

            implementation = payload.get("implementation")
            supplied_name = payload.get("supplied_name")
            impl_name = implementation.get("name") if isinstance(implementation, dict) else None
            if supplied_name == metric or impl_name == metric:
                payload["supplied_name"] = label
                if isinstance(implementation, dict):
                    implementation["name"] = label
                cur.execute(
                    "UPDATE trulens_feedback_defs SET feedback_json = ? WHERE feedback_definition_id = ?",
                    (json.dumps(payload), feedback_definition_id),
                )
                updated_feedbacks += 1

    cur.execute(
        "DELETE FROM trulens_feedback_defs WHERE feedback_definition_id NOT IN (SELECT DISTINCT feedback_definition_id FROM trulens_feedbacks)"
    )
    orphan_feedback_defs = cur.rowcount if cur.rowcount is not None else 0

    cur.execute(
        "DELETE FROM trulens_apps WHERE app_id NOT IN (SELECT DISTINCT app_id FROM trulens_records)"
    )
    orphan_apps = cur.rowcount if cur.rowcount is not None else 0

    conn.commit()
    conn.close()

    print(f"Deleted records: {deleted_records}")
    print(f"Deleted feedback rows: {deleted_feedbacks}")
    print(f"Deleted events: {deleted_events}")
    print(f"Localized feedback rows/defs: {updated_feedbacks}")
    print(f"Deleted orphan feedback defs: {orphan_feedback_defs}")
    print(f"Deleted orphan apps: {orphan_apps}")


if __name__ == "__main__":
    main()
