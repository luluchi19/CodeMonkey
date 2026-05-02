import sqlite3
import json
import time
import uuid
from pathlib import Path

DB = Path('.trulens') / 'default.sqlite'
if not DB.exists():
    raise SystemExit(f"Database not found: {DB}")

conn = sqlite3.connect(str(DB))
c = conn.cursor()

# find app_id
c.execute('SELECT app_id, app_name, app_version FROM trulens_apps LIMIT 1')
row = c.fetchone()
if not row:
    raise SystemExit('No app found in trulens_apps')
app_id, app_name, app_version = row

now = time.time()
record_id = 'record_' + uuid.uuid4().hex
event_id = 'event_' + uuid.uuid4().hex
feedback_result_id = 'fb_' + uuid.uuid4().hex

payload = {
    'repo': 'manual-seed',
    'prNumber': 0,
    'title': 'Seeded record',
    'description': 'Inserted by seed script',
    'review': 'This is a seeded review for local dashboard testing',
}
output = {'summary': 'Seeded review', 'checks': []}
perf_json = {
    'start_time': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(now)),
    'end_time': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(now + 0.000001)),
}

record_json = {
    'app_id': app_id,
    'input': payload,
    'output': output,
    'meta': {'seeded': True},
}

# insert record
c.execute(
    'INSERT INTO trulens_records(record_id, app_id, input, output, record_json, tags, ts, cost_json, perf_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    (
        record_id,
        app_id,
        json.dumps(payload),
        json.dumps(output),
        json.dumps(record_json),
        json.dumps([]),
        now,
        json.dumps({}),
        json.dumps(perf_json),
    ),
)

# insert event referencing record
event_row = {
    'record': record_json,
    'record_attributes': {},
    'record_type': 'record',
    'resource_attributes': {},
}
c.execute(
    'INSERT INTO trulens_events(event_id, record, record_attributes, record_type, resource_attributes, start_timestamp, timestamp, trace) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    (
        event_id,
        json.dumps(event_row),
        json.dumps({}),
        'record',
        json.dumps({}),
        now,
        now,
        json.dumps({}),
    ),
)

# find a feedback_definition_id to reference (if exists)
c.execute('SELECT feedback_definition_id FROM trulens_feedback_defs LIMIT 1')
fb_def = c.fetchone()
if fb_def:
    fb_def_id = fb_def[0]
    # insert feedback_result linking to record
    c.execute(
        'INSERT INTO trulens_feedbacks(feedback_result_id, record_id, feedback_definition_id, last_ts, status, error, calls_json, result, name, cost_json, multi_result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (
            feedback_result_id,
            record_id,
            fb_def_id,
            now,
            'completed',
            None,
            json.dumps({'calls': []}),
            1.0,
            'Seeded feedback',
            json.dumps({}),
            None,
        ),
    )

conn.commit()
conn.close()
print('Seed inserted:', record_id)
print('Run: python inspect_db.py to verify')
