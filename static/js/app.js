document.addEventListener('DOMContentLoaded', () => {
    fetchBaseInfo();
    fetchMaxVersion();
    fetchObjects();

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
            document.getElementById('time-val').textContent = maxVersionString;
        }
    } catch (e) {
        document.getElementById('time-val').textContent = 'Error';
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
    } catch (e) {}
}

// Handlers
function handleObjectSelection(e) {
    if (e.target.value) {
        send_alert(`Selected object: ${e.target.value}`);
    }
}

function send_alert(message) {
    alert(`[SYSTEM ALERT]\n${message}`);
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
    }
    
    addValidationItem(`Content Type Indentified: ${contentType}`, 'icon-green');

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

    // 1. Auto-rename file to MAX(VERSION) + 1
    let nextVersionObj = calculateNextVersion(maxVersionString);
    let newFileName = `V${nextVersionObj.major}_${nextVersionObj.minor}__fixed_${currentFileName.replace(/[^a-zA-Z0-9]/g, '_')}.sql`;
    
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
