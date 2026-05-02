from __future__ import annotations

import os

os.environ["TRULENS_OTEL_TRACING"] = "0"

from trulens.core import TruSession


def main() -> None:
    session = TruSession(database_url="sqlite:///.trulens/default.sqlite")
    records_df, feedback_cols = session.get_records_and_feedback(
        app_name="CodeMonkey Review",
        app_versions=["v1"],
    )

    print(f"records_count={len(records_df)}")
    print(f"feedback_cols={feedback_cols}")
    if len(records_df) > 0:
        print(records_df[["record_id", "app_name", "app_version", "ts"]].head())


if __name__ == "__main__":
    main()
