import sqlite3

db_path = ".trulens/default.sqlite"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"📊 Tables in database: {[t[0] for t in tables]}")
    
    if not tables:
        print("⚠️  No tables found!")
    else:
        for table_name in [t[0] for t in tables]:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"   - {table_name}: {count} rows")
    
    conn.close()
except Exception as e:
    print(f"❌ Error: {e}")
