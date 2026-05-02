import sqlite3, json
db = ".trulens/default.sqlite"
conn = sqlite3.connect(db)
c = conn.cursor()

tables = ["trulens_apps", "trulens_records", "trulens_events", "trulens_feedbacks", "trulens_feedback_defs"]
for t in tables:
    print("\n=== TABLE:", t, "===")
    try:
        for col in c.execute(f"PRAGMA table_info('{t}')"):
            print("COL:", col)
        print("\nSAMPLE ROWS:")
        for r in c.execute(f"SELECT * FROM {t} LIMIT 5"):
            print(r)
    except Exception as e:
        print("ERROR:", e)

conn.close()