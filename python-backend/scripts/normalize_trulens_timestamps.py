# scripts/normalize_trulens_timestamps.py
import sqlite3
from datetime import UTC, datetime
db = ".trulens/default.sqlite"

def ts_to_iso(v):
    try:
        # nếu là số (giây), chuyển thành ISO
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(float(v), UTC).isoformat()
        # nếu là string của số
        if isinstance(v, str) and v.replace('.','',1).isdigit():
            return datetime.fromtimestamp(float(v), UTC).isoformat()
    except Exception:
        pass
    return v

conn = sqlite3.connect(db)
c = conn.cursor()

# Update trulens_events timestamp columns to ISO strings if they are numeric
rows = list(c.execute("SELECT event_id, start_timestamp, timestamp FROM trulens_events"))
for event_id, start_ts, ts in rows:
    new_start = ts_to_iso(start_ts)
    new_ts = ts_to_iso(ts)
    if new_start != start_ts or new_ts != ts:
        c.execute(
            "UPDATE trulens_events SET start_timestamp = ?, timestamp = ? WHERE event_id = ?",
            (new_start, new_ts, event_id)
        )
        print("Updated event", event_id, "->", new_start, new_ts)

conn.commit()
conn.close()
print("Done normalizing timestamps.")