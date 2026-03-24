import os
import traceback
import getpass
import re
import sys

try:
    import oracledb
except Exception as e:
    print("ERROR: Failed importing oracledb:", e)
    print("Traceback:")
    traceback.print_exc()
    sys.exit(2)

# Read JDBC URL from env if provided, else use the one from the app
JDBC_URL = os.environ.get('JDBC_URL', 'jdbc:oracle:thin:@//dbhdwvn.vn.prod:1521/hdwvn.homecredit.vn')

# Optionally allow host/port/service override
host = os.environ.get('ORACLE_HOST')
port = os.environ.get('ORACLE_PORT')
service = os.environ.get('ORACLE_SERVICE')

if not (host and port and service):
    # parse JDBC_URL
    m = re.match(r'jdbc:oracle:thin:@//([^:]+):(\d+)/(.+)', JDBC_URL)
    if not m:
        print('ERROR: Could not parse JDBC URL:', JDBC_URL)
        sys.exit(2)
    host, port, service = m.groups()

user = os.environ.get('ORACLE_USER')
password = os.environ.get('ORACLE_PASSWORD')

if not user:
    user = input('Oracle username: ')
if not password:
    password = getpass.getpass('Oracle password: ')

print(f"Attempting to connect to {host}:{port}/{service} as user '{user}' (password not shown)")

dsn = f"{host}:{port}/{service}"

try:
    # Attempt connect (thin mode by default in python-oracledb)
    conn = oracledb.connect(user=user, password=password, dsn=dsn)
    print('Connected OK')
    try:
        cur = conn.cursor()
        cur.execute('SELECT 1 FROM DUAL')
        r = cur.fetchone()
        print('Test query result:', r)
        cur.close()
    except Exception as qerr:
        print('Connected but test query failed:')
        traceback.print_exc()
    finally:
        conn.close()
except Exception as e:
    print('CONNECT ERROR:')
    traceback.print_exc()
    # Also print a short one-line message (may include ORA code)
    print('\nOne-line error:', str(e))
    sys.exit(1)
