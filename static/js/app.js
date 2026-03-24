document.addEventListener('DOMContentLoaded', () => {
    fetchBaseInfo();
    fetchMaxVersion();
    fetchObjects();
    document.getElementById('objectSelect').addEventListener('change', handleObjectSelection);
    document.getElementById('notifyTeamsBtn').addEventListener('click', notifyTeams);
    document.getElementById('testDbBtn').addEventListener('click', testDbConnection);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('sqlFileInput').addEventListener('change', handleFileUpload);
    document.getElementById('objectSelect').addEventListener('change', handleObjectSelection);
    document.getElementById('fixIssuesBtn').addEventListener('click', handleFixIssues);
    document.getElementById('confirmBtn').addEventListener('click', handleConfirm);
});

let currentSqlContent = '';
let currentFileName = '';
let maxVersionString = 'V2_0'; // Default
let isFormatValid = false;

// API Fetchers
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.reload();
}

async function testDbConnection() {
    try {
        const res = await fetch('/api/db/test');
        const data = await res.json();
        if (data.success) {
            alert(data.message);
        } else {
            alert('Failed to connect: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        alert('Network error while testing connection.');
    }
}

async function fetchBaseInfo() {
    try {
        const res = await fetch('/api/db/info');
        if (res.status === 401) window.location.href = '/';
        const data = await res.json();
        document.getElementById('base-val').textContent = data.service_name || 'Error';
    } catch (e) {
        document.getElementById('base-val').textContent = 'Disconnected';
    }
}

async function fetchMaxVersion() {
    try {
        const res = await fetch('/api/db/version');
        const data = await res.json();
        if (data.max_version) {
            maxVersionString = data.max_version;
            // Show only the major (latest) version number in the LATEST VERSION box
            const m = /V?(\d+)/i.exec(maxVersionString);
            const major = m ? m[1] : maxVersionString;
            document.getElementById('time-val').textContent = major;
            // Keep next-version box logic using full maxVersionString
            updateNextVersionBox(maxVersionString);
        }
    } catch (e) {
        document.getElementById('time-val').textContent = 'Error';
        updateNextVersionBox(null);
    }
}

async function fetchObjects() {
    try {
        const res = await fetch('/api/db/objects');
        const data = await res.json();
        const select = document.getElementById('objectSelect');
        if (data.objects) {
            data.objects.forEach(obj => {
                const opt = document.createElement('option');
                opt.value = obj.name;
                opt.textContent = `[${obj.type}] ${obj.name}`;
                select.appendChild(opt);
            });
        }
    } catch (e) { }
}

function updateNextVersionBox(maxVersion) {
    const nextEl = document.getElementById('next-val');
    if (!nextEl) return;
    if (!maxVersion) {
        nextEl.textContent = '-';
        return;
    }
    const m = /V?(\d+)/i.exec(maxVersion);
    if (m) {
        const major = parseInt(m[1], 10);
        nextEl.textContent = String(major + 1);
    } else {
        nextEl.textContent = '-';
    }
}

// Handlers
function handleObjectSelection(e) {
    const notifyBtn = document.getElementById('notifyTeamsBtn');
    if (e.target.value) {
        // From 'Current': Show the UI banner
        const objectName = e.target.value;
        showWorkingBanner(document.getElementById('header'), objectName);

        // From your 'Stash': Alert the user
        send_alert(`Selected object: ${objectName}`);

        // Optional: If you still need that Teams button visible
        if (notifyBtn) {
            notifyBtn.textContent = `I'm working on ${objectName}`;
            notifyBtn.style.display = 'block';
        }
    } else {
        if (notifyBtn) notifyBtn.style.display = 'none';
    }
}
function send_alert(message) {
    alert(`[SYSTEM ALERT]\n${message}`);
}

function showWorkingBanner(anchorEl, objectName) {
    // remove old banner if exists
    const old = document.getElementById('working-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'working-banner';
    banner.style.marginTop = '8px';
    banner.style.padding = '8px';
    banner.style.border = '1px solid #ddd';
    banner.style.background = '#f9f9f9';
    banner.innerHTML = `
        <span>I'm working on <strong>${objectName}</strong></span>
        <button id="notify-working-btn" style="margin-left:12px">Notify team</button>
        <span id="notify-result" style="margin-left:12px"></span>
    `;

    anchorEl.insertAdjacentElement('afterend', banner);

    document.getElementById('notify-working-btn').addEventListener('click', function () {
        const resultEl = document.getElementById('notify-result');
        resultEl.textContent = ' Sending...';
        fetch('/api/notify_working', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ object: objectName })
        })
            .then(r => r.json())
            .then(j => {
                if (j && j.success) {
                    resultEl.textContent = ' Notified Teams';
                } else {
                    resultEl.textContent = ' Notification failed';
                    console.error('Teams notify failed', j);
                }
            })
            .catch(err => {
                resultEl.textContent = ' Error sending';
                console.error('Notify error', err);
            });
    });
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentFileName = file.name;
    document.getElementById('uploadFileName').textContent = currentFileName;

    const reader = new FileReader();
    reader.onload = (e) => {
        currentSqlContent = e.target.result;
        document.getElementById('rawSqlText').value = currentSqlContent;
        validateFile(currentFileName, currentSqlContent);
    };
    reader.readAsText(file);
}

function validateFile(filename, content) {
    const valList = document.getElementById('validationList');
    valList.innerHTML = '';

    let allValid = true;

    // 1. Naming Convention
    let nameValid = false;
    let nameType = 'Unknown';

    if (filename.startsWith('.')) {
        nameValid = true;
        nameType = 'Git-Only System File';
    } else if (/^R__.*\.sql$/i.test(filename)) {
        nameValid = true;
        nameType = 'Repeatable Migration';
    } else {
        const versionMatch = /^V(\d+)_(\d+)__.*\.sql$/i.exec(filename);
        if (versionMatch) {
            const majorVersion = parseInt(versionMatch[1], 10);
            if (majorVersion >= 2) {
                nameValid = true;
                nameType = `Versioned Migration (V${majorVersion})`;
            } else {
                nameValid = false;
                nameType = 'Invalid Version (Must start at V2)';
            }
        } else {
            nameValid = false;
            nameType = 'Invalid Format (Missing __ or wrong prefix)';
        }
    }

    addValidationItem(
        `Naming Convention: ${nameType}`,
        nameValid ? 'icon-green' : 'icon-red'
    );
    if (!nameValid) allValid = false;

    // 2. Content Type Identity (DDL vs DML vs Repeatable)
    let contentType = 'Unknown';
    if (nameType.includes('Repeatable')) {
        contentType = 'Repeatable View/Procedure Structure';
    } else {
        const upperContent = content.toUpperCase();
        const hasDDL = /CREATE |ALTER |DROP |TRUNCATE /i.test(upperContent);
        const hasDML = /INSERT |UPDATE |DELETE |MERGE /i.test(upperContent);

        if (hasDDL && hasDML) contentType = 'Mixed DDL & DML';
        else if (hasDDL) contentType = 'DDL (Data Definition)';
        else if (hasDML) contentType = 'DML (Data Manipulation)';
        else contentType = 'Plain Query / Other';
        const contentType = detectSqlType(content);
        let contentTypeLabel = '';
        switch (contentType) {
            case 'REPEATABLE': contentTypeLabel = 'Repeatable (Idempotent)'; break;
            case 'DDL': contentTypeLabel = 'DDL (Data Definition)'; break;
            case 'DML': contentTypeLabel = 'DML (Data Manipulation)'; break;
            case 'MIXED': contentTypeLabel = 'Mixed DDL & DML'; break;
            default: contentTypeLabel = 'Plain Query / Other';
        }

        addValidationItem(`Content Type Indentified: ${contentType}`, 'icon-green');

        addValidationItem(`Content Type Identified: ${contentTypeLabel}`, 'icon-green');

        // 3. Enable Fix Issues Button
        document.getElementById('fixIssuesBtn').disabled = false;
        document.getElementById('confirmBtn').disabled = true;

        isFormatValid = allValid;
    }

    function addValidationItem(text, iconClass) {
        const valList = document.getElementById('validationList');
        const li = document.createElement('li');
        li.className = 'val-item';
        li.innerHTML = `<span class="val-icon ${iconClass}"></span> ${text}`;
        valList.appendChild(li);
    }

    async function handleFixIssues() {
        const fixBtn = document.getElementById('fixIssuesBtn');
        fixBtn.disabled = true;
        fixBtn.textContent = 'Fixing...';
        const originalFileName = currentFileName;

        // 1. Auto-rename file to MAX(VERSION) + 1
        let nextVersionObj = calculateNextVersion(maxVersionString);
        let newFileName = `V${nextVersionObj.major}_${nextVersionObj.minor}__fixed_${currentFileName.replace(/[^a-zA-Z0-9]/g, '_')}.sql`;

        // 1. Auto-rename file to MAX(VERSION) + 1 using generator
        let newFileName = generateMigrationFilename(currentSqlContent, currentFileName, maxVersionString);

        // 2. Format SQL Text (Python backend)
        try {
            const res = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: currentSqlContent, filename: currentFileName })
            });
            const data = await res.json();

            if (data.fixed_sql) {
                document.getElementById('fixedSqlText').value = data.fixed_sql;
                currentFileName = newFileName;
                currentSqlContent = data.fixed_sql;
                document.getElementById('uploadFileName').textContent = currentFileName;

                // Re-validate UI
                addValidationItem(`Formatting validated with sqlfluff (Oracle dialect).`, 'icon-green');
                addValidationItem(`File renamed to ${newFileName}`, 'icon-green');


                // Decide naming based on SQL type
                const finalSql = data.fixed_sql || currentSqlContent;
                const sqlType = detectSqlType(finalSql);

                if (sqlType === 'REPEATABLE') {
                    // Repeatable scripts don't use versioning; name as R__description.sql
                    currentFileName = generateMigrationFilename(finalSql, currentFileName, maxVersionString);
                    currentSqlContent = finalSql;
                    document.getElementById('uploadFileName').textContent = currentFileName;

                    addValidationItem(`Formatting validated with sqlfluff (Oracle dialect).`, 'icon-green');
                    const displayName = currentFileName.replace(/\.sql$/i, '');
                    addValidationItem(`Repeatable file renamed to ${displayName}`, 'icon-green');
                } else {
                    // Ask user for subversion (minor) to build final filename
                    let subversion = window.prompt('Enter subversion number (minor) for this migration (e.g. 1):', '1');
                    if (subversion === null) {
                        // user cancelled - restore state and abort
                        addValidationItem('File rename cancelled by user.', 'icon-red');
                        document.getElementById('fixedSqlText').value = '';
                        currentFileName = originalFileName || currentFileName;
                        fixBtn.textContent = 'Fix Issues';
                        fixBtn.disabled = false;
                        return;
                    }

                    // validate subversion
                    subversion = subversion.toString().trim();
                    if (!/^[0-9]+$/.test(subversion)) {
                        addValidationItem('Invalid subversion provided; using 1.', 'icon-red');
                        subversion = '1';
                    }

                    currentFileName = generateMigrationFilename(finalSql, currentFileName, maxVersionString, subversion);
                    currentSqlContent = finalSql;
                    document.getElementById('uploadFileName').textContent = currentFileName;

                    addValidationItem(`Formatting validated with sqlfluff (Oracle dialect).`, 'icon-green');
                    const displayName = currentFileName.replace(/\.sql$/i, '');
                    addValidationItem(`File renamed to ${displayName}`, 'icon-green');
                }

                if (data.lint_issues && data.lint_issues.length > 0) {
                    addValidationItem(`Syntax/Lint checker found ${data.lint_issues.length} lingering formatting issues.`, 'icon-red');
                } else {
                    addValidationItem(`No syntax issues found according to sqlfluff!`, 'icon-green');
                }


                document.getElementById('confirmBtn').disabled = false;
            } else if (data.error) {
                alert('SQL Syntax Error: ' + data.error);
            } else {
                alert('Failed to format SQL properly.');
            }
        } catch (e) {
            alert('API Error while fixing issues.');
        } finally {
            fixBtn.textContent = 'Fix Issues';
            fixBtn.disabled = false;
        }
    }

    function calculateNextVersion(maxV) {
        // Expects "V2_4" or "V2.4" or "2"
        const match = /V?(\d+)[_\.]?(\d+)?/i.exec(maxV);
        if (match) {
            let major = parseInt(match[1]);
            let minor = match[2] ? parseInt(match[2]) : 0;
            return { major: major, minor: minor + 1 };
        }
        return { major: 2, minor: 1 }; // Default fallback
    }

    // Global SQL type detector used by multiple helpers
    function detectSqlType(sqlText) {
        if (!sqlText || sqlText.trim().length === 0) return 'OTHER';
        const s = sqlText.toUpperCase();

        // Detect repeatable/idempotent patterns first
        const isRepeatable = /CREATE\s+OR\s+REPLACE|IF\s+EXISTS|DROP\s+IF\s+EXISTS|CREATE\s+OR\s+REPLACE\s+(FUNCTION|PROCEDURE|PACKAGE|VIEW|TRIGGER)/i.test(sqlText);
        if (isRepeatable) return 'REPEATABLE';

        const hasDDL = /\b(CREATE|ALTER|DROP|TRUNCATE|RENAME|COMMENT)\b/i.test(s);
        const hasDML = /\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(s);

        if (hasDDL && hasDML) return 'MIXED';
        if (hasDDL) return 'DDL';
        if (hasDML) return 'DML';
        return 'OTHER';
    }

    function generateMigrationFilename(sqlContent, originalName, maxVersion, subversion) {
        // Use detected SQL type to decide naming
        const sqlType = detectSqlType(sqlContent);

        // Helper to extract object/op using heuristics
        const patterns = [
            { r: /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+([\w\."$#]+)\b/i, op: 'create_table' },
            { r: /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([\w\."$#]+)\b/i, op: 'create_view' },
            { r: /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([\w\."$#]+)\b/i, op: 'create_procedure' },
            { r: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w\."$#]+)\b/i, op: 'create_function' },
            { r: /CREATE\s+(?:OR\s+REPLACE\s+)?PACKAGE(?:\s+BODY)?\s+([\w\."$#]+)\b/i, op: 'create_package' },
            { r: /INSERT\s+INTO\s+([\w\."$#]+)\b/i, op: 'insert' },
            { r: /UPDATE\s+([\w\."$#]+)\b/i, op: 'update' },
            { r: /DELETE\s+FROM\s+([\w\."$#]+)\b/i, op: 'delete' },
            { r: /MERGE\s+INTO\s+([\w\."$#]+)\b/i, op: 'merge' }
        ];

        let op = 'script';
        let obj = '';
        for (const p of patterns) {
            const m = p.r.exec(sqlContent);
            if (m && m[1]) {
                op = p.op;
                let name = m[1];
                name = name.replace(/"/g, '');
                if (name.indexOf('.') !== -1) name = name.split('.').pop();
                obj = name;
                break;
            }
        }

        if (!obj) obj = originalName.replace(/\.[^.]+$/, '');

        const safeObj = String(obj).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const safeOp = String(op).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

        if (sqlType === 'REPEATABLE') {
            // Repeatable scripts: R__description.sql
            const desc = safeOp && safeObj ? `${safeOp}_${safeObj}` : safeObj || safeOp || originalName.replace(/\.[^.]+$/, '');
            const safeDesc = String(desc).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            return `R__${safeDesc}.sql`;
        }

        // For DDL/DML/MIXED fallback to versioned naming V{major}_{minor}__{op}_{obj}.sql
        let major = 2; // default
        if (maxVersion) {
            const mm = /V?(\d+)/i.exec(maxVersion);
            if (mm) major = parseInt(mm[1], 10) + 1;
        }

        let minor = 1;
        if (typeof subversion !== 'undefined' && subversion !== null) {
            const sv = parseInt(subversion, 10);
            if (!isNaN(sv) && sv >= 0) minor = sv;
        }

        return `V${major}_${minor}__${safeOp}_${safeObj}.sql`;
    }

    async function handleConfirm() {
        // 1. Download file
        const blob = new Blob([currentSqlContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // 2. DB Insert Action
        try {
            const nextVersionObj = calculateNextVersion(maxVersionString);
            const versionToLog = `V${nextVersionObj.major}_${nextVersionObj.minor}`;

            const res = await fetch('/api/db/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: currentFileName,
                    version: versionToLog
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Migration deployed AND logged successfully.\nMode: ${data.mocked ? 'Mock DB API' : 'Oracle Network'}!`);
                window.location.reload();
            } else {
                alert(`Error logging to tracking table: ${data.error}`);
            }
        } catch (e) {
            alert('Network error while deploying.');
        }
    }
