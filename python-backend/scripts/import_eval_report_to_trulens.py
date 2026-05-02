from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from lib.trulens_recorder import record_trulens_review


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("scripts/eval_report.json")
    if not source.exists():
        raise SystemExit(f"Input JSON not found: {source}")

    data = json.loads(source.read_text(encoding="utf-8"))
    rows = data.get("rows") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise SystemExit("Invalid input: expected top-level object with 'rows' array.")

    ok_count = 0
    fail_count = 0
    for row in rows:
        if not isinstance(row, dict):
            continue

        payload = {
            "reviewId": row.get("reviewId"),
            "repo": row.get("repo"),
            "prNumber": row.get("prNumber"),
            "title": f"Backfill review {row.get('reviewId')}",
            "description": "Imported from eval-report",
            "review": row.get("notes") or "Backfilled evaluation record",
            "notes": row.get("notes") or "",
            "scores": {
                "groundedness": row.get("groundedness"),
                "relevance": row.get("relevance"),
                "contextRelevance": row.get("contextRelevance"),
                "actionability": row.get("actionability"),
                "falsePositiveRisk": row.get("falsePositiveRisk"),
                "readability": row.get("readability"),
                "brevity": row.get("brevity"),
                "coverage": row.get("coverage"),
                "honestHelpful": row.get("honestHelpful"),
                "model": row.get("model"),
                "notes": row.get("notes"),
            },
        }

        ok, msg = record_trulens_review(payload)
        if ok:
            ok_count += 1
        else:
            fail_count += 1
            print(f"Failed row reviewId={row.get('reviewId')}: {msg}")

    print(f"Imported rows: ok={ok_count}, failed={fail_count}")


if __name__ == "__main__":
    main()
