# scripts/print_trulens_records.py
import sqlite3, json
db = ".trulens/default.sqlite"
conn = sqlite3.connect(db)
c = conn.cursor()
print("=== APPS ===")
for r in c.execute("SELECT app_id, app_name, app_version FROM trulens_apps"):
    print(r)
print("\n=== RECORDS ===")
for r in c.execute("SELECT record_id, app_id, record_json, ts FROM trulens_records"):
    print(r[0], r[1], json.loads(r[2]))
print("\n=== EVENTS ===")
for r in c.execute("SELECT event_id, record, record_type, timestamp FROM trulens_events"):
    print(r[0], json.loads(r[1]) if r[1] else None, r[2], r[3])
conn.close()