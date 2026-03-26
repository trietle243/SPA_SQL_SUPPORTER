# SPA SQL Supporter

A specialized Single-Page Application (SPA) designed to support developers in validating, formatting, and tracking SQL migrations for Oracle databases. This tool ensures naming conventions, performs linting using `sqlfluff`, and integrates with Power Automate for team notifications.

---

## 🚀 Installation Guide

### 1. Prerequisites
- **Python 3.9+**
- **Oracle Instant Client**: Required for `oracledb` thick mode (if needed) or basic connectivity.
- **Oracle Database Access**: Valid credentials for the target Oracle instance.

### 2. Clone the Repository
```powershell
git clone <repository-url>
cd SPA_SQL_SUPPORTER
```

### 3. Setup Project with uv
```powershell
# Install all dependencies and create .venv automatically
uv sync
```

### 4. Running the App
```powershell
uv run python app.py
```

### 5. Configuration (.env)
Create a `.env` file in the root directory with the following variables:
```env
FLASK_SECRET_KEY=your_secure_random_key
TRACKING_TABLE_NAME=AP_SALES.GIT_NAME_LOG
# Optional: Only if you still use the legacy teams test route
TEAMS_WEBHOOK_URL=your_teams_webhook_url
```

---

## 📖 User Manual

### 1. Authentication
Upon launching the app, you will be prompted with a login screen.
- **Username/Password**: Use your Oracle Database credentials.
- The app attempts a real-time connection to validate your access before granting entry.

### 2. Connection Dashboard
Once logged in, the top metadata bar displays:
- **BASE**: The current Oracle Service Name you are connected to.
- **LATEST VERSION**: The highest migration version found in the tracking table.
- **NEXT VERSION**: The suggested version number for your next script.

### 3. Database Object Explorer & Notifications
- Select a database object (Procedure, Package, View) from the dropdown.
- Once selected, a **"I'm working on..."** banner appears.
- Click **"Notify team"** to send an automated alert via Power Automate to your team members, preventing concurrent edits on the same object.

### 4. SQL Migration Workflow
#### Step A: Upload
Click **"Choose .sql File"** to upload your migration script. The raw content will appear in the "Raw SQL Viewer".

#### Step B: Validate & Fix
Click **"Fix Issues"**. The app will:
1. **Lint & Format**: Use `sqlfluff` (Oracle dialect) to clean up your SQL syntax.
2. **Naming Check**: Verify if the filename follows the standard (`V<Major>_<Minor>__<Op>_<Obj>.sql` or `R__<Desc>.sql`).
3. **Auto-Rename**: 
   - If it's a **Repeatable** script (e.g., `CREATE OR REPLACE`), it prefix it with `R__`.
   - If it's a **Versioned** script, it will prompt you for a subversion number and automatically increment the major version based on the DB state.

#### Step C: Confirm & Deploy
Review the "Fixed SQL Preview". If satisfied, click **"Confirm & Deploy"**.
- The app will automatically download the correctly named and formatted file to your machine.
- It will also log the migration (Filename, Version, User, Timestamp) into the `GIT_NAME_LOG` tracking table in Oracle.

---

## 🛠 Tech Stack
- **Backend**: Flask (Python)
- **Database**: Oracle (`oracledb`)
- **SQL Engine**: `sqlfluff` (Oracle Dialect)
- **Frontend**: Vanilla JS, CSS3 (Modern UI with Inter font)
- **Integration**: Power Automate via HTTP Webhooks

---

## 🔒 Security Note
*This item’s classification is **Internal**. It was created by and is in property of **Home Credit**. Do not distribute outside of the organization.*
