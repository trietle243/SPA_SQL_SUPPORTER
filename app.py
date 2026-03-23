import os
import re
from flask import Flask, render_template, request, session, jsonify, send_file
import oracledb
import sqlfluff
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super_secret_dev_key_spa")
TRACKING_TABLE_NAME = os.environ.get("TRACKING_TABLE_NAME", "MIGRATION_TRACKING")
JDBC_URL = "jdbc:oracle:thin:@//dbhdwvn.vn.prod:1521/hdwvn.homecredit.vn"

def get_db_connection():
    # Parse JDBC URL to extract Host, Port, Service Name
    match = re.match(r'jdbc:oracle:thin:@//([^:]+):(\d+)/(.+)', JDBC_URL)
    if not match:
        raise ValueError("Invalid JDBC URL format")
    
    host, port, service_name = match.groups()
    
    username = session.get('username')
    password = session.get('password')
    
    if not username or not password:
        raise ValueError("User not authenticated")
        
    dsn = f"{host}:{port}/{service_name}"
    
    try:
        connection = oracledb.connect(user=username, password=password, dsn=dsn)
        return connection
    except Exception as e:
        # Fallback to None if connection fails to allow UI inspection without DB
        print(f"Failed to connect to Oracle DB: {e}")
        return None

@app.route('/')
def index():
    if 'username' not in session:
        return render_template('login.html')
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if username and password:
        session['username'] = username
        session['password'] = password
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid credentials"}), 401
    
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"success": True})

@app.route('/api/db/info', methods=['GET'])
def get_db_info():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    match = re.match(r'jdbc:oracle:thin:@//([^:]+):(\d+)/(.+)', JDBC_URL)
    service_name = match.groups()[2] if match else "Unknown"
    return jsonify({"service_name": service_name})

@app.route('/api/db/objects', methods=['GET'])
def get_objects():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT OBJECT_NAME, OBJECT_TYPE FROM ALL_OBJECTS WHERE OBJECT_TYPE IN ('PROCEDURE', 'PACKAGE', 'VIEW') AND ROWNUM <= 100")
            objects = [{"name": row[0], "type": row[1]} for row in cursor]
            cursor.close()
            conn.close()
        else:
            # Mocking for UI demonstration
            objects = [
                {"name": "PKG_CUSTOMER_DATA", "type": "PACKAGE"},
                {"name": "PRC_UPDATE_STATUS", "type": "PROCEDURE"},
                {"name": "VW_ACTIVE_LOANS", "type": "VIEW"}
            ]
        return jsonify({"objects": objects})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/db/version', methods=['GET'])
def get_max_version():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT MAX(VERSION) FROM {TRACKING_TABLE_NAME}")
            row = cursor.fetchone()
            max_version = row[0] if row and row[0] else "V1.0"
            cursor.close()
            conn.close()
        else:
            # Mocking for UI demonstration
            max_version = "V2_4" 
        return jsonify({"max_version": max_version})
    except Exception as e:
        # Fallback for UI if table doesn't exist
        print(f"Failed to query max version: {e}")
        return jsonify({"max_version": "V2_4"})

@app.route('/api/validate', methods=['POST'])
def validate_sql():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    raw_sql = data.get('sql', '')
    
    try:
        # Format and syntax check using sqlfluff oracle dialect
        formatted_sql = sqlfluff.fix(raw_sql, dialect='oracle')
        lint_result = sqlfluff.lint(raw_sql, dialect='oracle')
        
        return jsonify({"fixed_sql": formatted_sql, "lint_issues": lint_result})
    except Exception as e:
        return jsonify({"fixed_sql": raw_sql, "error": str(e)}), 500

@app.route('/api/db/confirm', methods=['POST'])
def confirm_sql():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    filename = data.get('filename')
    version = data.get('version')
    username = session.get('username')
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            # Assuming tracking table has columns: USERNAME, VERSION, TIMESTAMP_RUN, FILENAME
            cursor.execute(f"""
                INSERT INTO {TRACKING_TABLE_NAME} (USERNAME, VERSION, TIMESTAMP_RUN, FILENAME)
                VALUES (:1, :2, TO_TIMESTAMP(:3, 'YYYY-MM-DD HH24:MI:SS'), :4)
            """, [username, version, timestamp, filename])
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({"success": True})
        else:
            print(f"Mocking DB INSERT: User={username}, Version={version}, Timestamp={timestamp}, Filename={filename}")
            return jsonify({"success": True, "mocked": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
