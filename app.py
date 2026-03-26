import os
from dotenv import load_dotenv
import re
import json
import urllib.request
from flask import Flask, render_template, request, session, jsonify, send_file
import oracledb
import requests
import sqlfluff
from datetime import datetime, timezone, timedelta

app = Flask(__name__)
load_dotenv()
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super_secret_dev_key_spa")
TRACKING_TABLE_NAME = os.environ.get("TRACKING_TABLE_NAME", "AP_SALES.GIT_NAME_LOG")
JDBC_URL = "jdbc:oracle:thin:@//dbhdwvn.vn.prod:1521/hdwvn.homecredit.vn"

def get_db_connection(raise_on_error=False):
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
        # Print for server-side logs and optionally raise for diagnostics
        print(f"Failed to connect to Oracle DB: {e}")
        if raise_on_error:
            raise
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
        # Attempt a real DB connection to validate credentials before saving to session
        match = re.match(r'jdbc:oracle:thin:@//([^:]+):(\d+)/(.+)', JDBC_URL)
        if not match:
            return jsonify({"success": False, "error": "Invalid JDBC URL configuration"}), 500
        host, port, service_name = match.groups()
        dsn = f"{host}:{port}/{service_name}"
        try:
            conn = oracledb.connect(user=username, password=password, dsn=dsn)
            conn.close()
            session['username'] = username
            session['password'] = password
            return jsonify({"success": True})
        except Exception as e:
            # Do not store credentials; return a clear error for the client
            return jsonify({"success": False, "error": str(e)}), 401
    return jsonify({"success": False, "error": "Missing username or password"}), 400
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear() # Xóa sạch username và password đã lưu
    return jsonify({"success": True})

@app.route('/api/db/info', methods=['GET'])
def get_db_info():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    match = re.match(r'jdbc:oracle:thin:@//([^:]+):(\d+)/(.+)', JDBC_URL)
    service_name = match.groups()[2] if match else "Unknown"
    return jsonify({"service_name": service_name})

@app.route('/api/db/test', methods=['GET'])
def test_connection():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    try:
        # Request connection and ask for diagnostic exception if it fails
        conn = get_db_connection(raise_on_error=True)
        if conn:
            conn.close()
            return jsonify({"success": True, "message": "successfully connected"})
        # Shouldn't reach here when raise_on_error=True, but keep fallback
        return jsonify({"success": False, "error": "failed to connect"})
    except Exception as e:
        # Return the underlying error to help debug connectivity/auth issues
        return jsonify({"success": False, "error": str(e)}), 200

@app.route('/api/notify_working', methods=['POST'])
def notify_teams():
    # 1. Authorization Check
    if 'username' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    # 2. Get the session username
    username = session.get('username', 'Unknown User')
    
    # 3. Get the JSON data from the JS fetch (the "what")
    data = request.get_json(force=True, silent=True) or {}
    object_name = data.get('object_name')
    
    if not object_name:
        return jsonify({"success": False, "error": "Missing object name"}), 400

    # 4. Your Power Automate Group Chat Workflow URL
    FLOW_URL = "https://default5675d32119d14c9596842c28ac8f80.a4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/a9482fcd52574326a2d3e741856cdb7a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=NqU55o3sRTOu7kqG78KRLU4creSZ4hk7pFvcng26YVA"

    # 5. Payload for Power Automate (Matches your triggerOutputs() expressions)
    payload = {
        "username": username,
        "object_name": object_name
    }

    try:
        # Prepare the request
        req = urllib.request.Request(
            FLOW_URL, 
            data=json.dumps(payload).encode('utf-8')
        )
        req.add_header('Content-Type', 'application/json')

        # Send the request to Power Automate
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            # Power Automate typically returns 202 (Accepted) for these triggers
            if status_code in [200, 202]:
                print(f"DEBUG: Power Automate notified for {object_name} by {username}")
                return jsonify({"success": True})
            else:
                return jsonify({
                    "success": False, 
                    "error": f"Flow returned status {status_code}"
                })

    except Exception as e:
        print(f"ERROR: Failed to trigger Flow: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/db/objects', methods=['GET'])
def get_objects():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT OBJECT_NAME, OBJECT_TYPE FROM AP_SALES.ALL_AP_SALES_OBJECTS WHERE OBJECT_TYPE IN ('PROCEDURE', 'PACKAGE', 'PACKAGE BODY', 'VIEW') AND ROWNUM <= 100")
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

@app.route('/api/teams_test', methods=['POST'])
def teams_test():
    """Send a server-side test message to the configured Teams webhook.
    Requires an authenticated session. Accepts optional JSON {"message": "..."}.
    """
    if 'username' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    webhook = os.environ.get('TEAMS_WEBHOOK_URL')
    if not webhook:
        return jsonify({"error": "Teams webhook not configured"}), 500

    data = request.get_json(force=True, silent=True) or {}
    # Format test message timestamp in GMT+7
    tz = timezone(timedelta(hours=7))
    default_ts = datetime.now(tz).strftime("%Y-%m-%d %I:%M:%S %p")
    message = data.get('message') or f"Test message from {session.get('username')} at {default_ts} (GMT+7)"

    payload = {"text": message}
    try:
        resp = requests.post(webhook, json=payload, timeout=5)
        resp.raise_for_status()
    except Exception as e:
        print(f"Failed to send Teams test message: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

    return jsonify({"success": True})

@app.route('/api/db/version', methods=['GET'])
def get_max_version():
    if 'username' not in session:
         return jsonify({"error": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            # Query the configured tracking table for the latest version
            cursor.execute(f"SELECT MAX(VERSION) FROM {TRACKING_TABLE_NAME}")
            row = cursor.fetchone()
            max_version = row[0] if row and row[0] is not None else None
            cursor.close()
            conn.close()
        else:
            # Mocking for UI demonstration
            max_version = "V2_4"
        return jsonify({"max_version": max_version})
    except Exception as e:
        print(f"Failed to query max version: {e}")
        return jsonify({"error": str(e)}), 500

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
