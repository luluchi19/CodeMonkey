import sqlite3

db_path = ".trulens/default.sqlite"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check apps table
    cursor.execute("SELECT COUNT(*) FROM apps;")
    apps_count = cursor.fetchone()[0]
    print(f"✅ Apps count: {apps_count}")
    
    # Check records table
    cursor.execute("SELECT COUNT(*) FROM records;")
    records_count = cursor.fetchone()[0]
    print(f"✅ Records count: {records_count}")
    
    # Show app names if any
    if apps_count > 0:
        cursor.execute("SELECT app_name, app_version FROM apps;")
        for row in cursor.fetchall():
            print(f"   - App: {row[0]} v{row[1]}")
    
    conn.close()
except Exception as e:
    print(f"❌ Error: {e}")
