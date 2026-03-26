document.addEventListener('DOMContentLoaded', () => {
    fetchBaseInfo();
    fetchMaxVersion();
    fetchObjects();
    document.getElementById('objectSelect').addEventListener('change', handleObjectSelection);
    document.getElementById('notifyTeamsBtn').addEventListener('click', notifyTeams);
    document.getElementById('testDbBtn').addEventListener('click', testDbConnection);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('sqlFileInput').addEventListener('change', handleFileUpload);
    document.getElementById('checkIssuesBtn').addEventListener('click', handleCheckIssues);
    document.getElementById('fixIssuesBtn').addEventListener('click', handleFixIssues);
    document.getElementById('confirmBtn').addEventListener('click', handleConfirm);
    document.getElementById('confirmSubBtn').addEventListener('click', onSubversionConfirm);
    document.getElementById('cancelSubBtn').addEventListener('click', () => {
        document.getElementById('subversionModal').style.display = 'none';
        const fixBtn = document.getElementById('fixIssuesBtn');
        fixBtn.textContent = 'Fix Issues';
        fixBtn.disabled = false;
    });
    initTheme();
});

let currentSqlContent = '';
let currentFileName = '';
let maxVersionString = 'V2_0'; // Default
let isFormatValid = false;

// API Fetchers
async function logout() {
    // Gọi đúng endpoint bạn sẽ định nghĩa ở Python (ví dụ: /api/logout)
    const response = await fetch('/api/logout', { method: 'POST' });
    
    if (response.ok) {
        // Chuyển hướng về trang chủ để Python check lại session
        window.location.href = '/'; 
    } else {
        alert("Logout failed!");
    }
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
            const m = /V?(\d+)/i.exec(maxVersionString);
            const major = m ? parseInt(m[1], 10) : 0;
            
            // --- ANIMATED COUNTERS ---
            animateValue("time-val", 0, major, 1000);
            animateValue("next-val", 0, major + 1, 1000);
        }
    } catch (e) {
        document.getElementById('time-val').textContent = 'Error';
    }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// static/js/app.js
async function fetchObjects() {
    try {
        const res = await fetch('/api/db/objects');
        const data = await res.json();
        const select = document.getElementById('objectSelect');

        if (data.objects) {
            select.innerHTML = '<option value="">-- Select Object --</option>'; // Clear & Placeholder
            data.objects.forEach(obj => {
                const opt = document.createElement('option');
                // Store both name and type in the value for the backend to use
                opt.value = obj.name;
                // Display: [PROCEDURE] ACL_DOCUMENT
                opt.textContent = `[${obj.type}] ${obj.name}`;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error("Failed to load objects", e); }
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
        const objectName = e.target.value;
        const cleanName = objectName.replace(/^\[.*?\]\s*/, '').trim();

        if (notifyBtn) {
            notifyBtn.textContent = `Notify team: I'm working on ${cleanName}`;
            notifyBtn.style.display = 'block';
        }
    } else {
        if (notifyBtn) notifyBtn.style.display = 'none';
    }
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
        
        // Show in pretty box with Prism highlighting
        const rawCodeEl = document.getElementById('rawSqlCode');
        rawCodeEl.textContent = currentSqlContent;
        Prism.highlightElement(rawCodeEl);
        
        // Clear old comparison box
        document.getElementById('fixedSqlDisplay').innerHTML = '';
        
        // Update Stepper
        updateStepper(1);
        
        validateFile(currentFileName, currentSqlContent);
    };
    reader.readAsText(file);
}

function updateStepper(activeStep) {
    const steps = ['step1', 'step2', 'step3', 'step4'];
    steps.forEach((id, index) => {
        const step = document.getElementById(id);
        const connector = step.nextElementSibling;
        
        step.classList.remove('active', 'complete');
        if (connector && connector.classList.contains('step-connector')) {
            connector.classList.remove('complete');
        }

        if (index + 1 < activeStep) {
            step.classList.add('complete');
            if (connector && connector.classList.contains('step-connector')) {
                connector.classList.add('complete');
            }
        } else if (index + 1 === activeStep) {
            step.classList.add('active');
        }
    });
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

    addValidationItem(`Naming Convention: ${nameType}`, nameValid ? 'icon-green' : 'icon-red');
    if (!nameValid) allValid = false;

    // 2. Content Type Identity
    // Use your existing detectSqlType function instead of manual regex here
    const detectedType = detectSqlType(content);
    let contentTypeLabel = '';

    switch (detectedType) {
        case 'REPEATABLE': contentTypeLabel = 'Repeatable (Idempotent)'; break;
        case 'DDL': contentTypeLabel = 'DDL (Data Definition)'; break;
        case 'DML': contentTypeLabel = 'DML (Data Manipulation)'; break;
        case 'MIXED': contentTypeLabel = 'Mixed DDL & DML'; break;
        default: contentTypeLabel = 'Plain Query / Other';
    }

    addValidationItem(`Content Type Identified: ${contentTypeLabel}`, 'icon-green');

    // 3. Enable UI Buttons
    document.getElementById('checkIssuesBtn').disabled = false;
    document.getElementById('fixIssuesBtn').disabled = true;
    document.getElementById('confirmBtn').disabled = true;

    isFormatValid = allValid;
}

async function handleCheckIssues() {
    const checkBtn = document.getElementById('checkIssuesBtn');
    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking...';
    
    // Clear list
    const valList = document.getElementById('validationList');
    valList.innerHTML = '';
    
    try {
        const res = await fetch('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql: currentSqlContent, checkOnly: true }) 
        });
        const data = await res.json();

        if (data.lint_issues) {
            if (data.lint_issues.length > 0) {
                addValidationItem(`Lint checker found ${data.lint_issues.length} issues that need fixing.`, 'icon-red');
                
                // Highlight rows in Raw SQL Viewer
                highlightRawSqlErrors(data.lint_issues);
            } else {
                addValidationItem(`Code seems clean already, but you can still run Fix to ensure latest versioning/renaming.`, 'icon-green');
            }
            document.getElementById('fixIssuesBtn').disabled = false;
            // Update Stepper to Check
            updateStepper(2);
        }
    } catch (e) {
        alert('API Error while checking issues.');
    } finally {
        checkBtn.textContent = 'Check Issues';
        checkBtn.disabled = false;
    }
}

function highlightRawSqlErrors(issues) {
    const rawCodeEl = document.getElementById('rawSqlCode');
    
    // We recreate the inner structure to allow per-line highlights
    const lines = currentSqlContent.split('\n');
    const errorLines = new Set(issues.filter(i => i.line).map(i => i.line));
    
    rawCodeEl.innerHTML = '';
    lines.forEach((lineText, index) => {
        const lineNum = index + 1;
        const lineSpan = document.createElement('span');
        lineSpan.style.display = 'block';
        
        if (errorLines.has(lineNum)) {
            lineSpan.className = 'lint-error';
        }
        
        // Highlight this specific line with Prism
        lineSpan.innerHTML = Prism.highlight(lineText || ' ', Prism.languages.sql, 'sql');
        rawCodeEl.appendChild(lineSpan);
    });
}

function addValidationItem(text, iconClass, isFinal = false) {
    const valList = document.getElementById('validationList');
    const li = document.createElement('li');
    li.className = 'val-item';
    
    if (isFinal) {
        li.style.marginTop = '15px';
        li.style.paddingTop = '15px';
        li.style.borderTop = '1px solid #FEE2E2';
        li.style.fontWeight = '800';
        li.style.fontSize = '1.125rem';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.gap = '1rem';
        
        li.innerHTML = `
            <span class="val-icon ${iconClass}"></span>
            <span>${text}</span>
            <img src="/static/css/duypb.jpg" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--success-green); box-shadow: var(--shadow-sm); transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.5)'" onmouseout="this.style.transform='scale(1)'">
        `;
    } else {
        li.innerHTML = `<span class="val-icon ${iconClass}"></span> ${text}`;
    }
    
    valList.appendChild(li);
}

async function handleFixIssues() {
    const fixBtn = document.getElementById('fixIssuesBtn');
    fixBtn.disabled = true;
    fixBtn.textContent = 'Fixing...';
    
    // 1. Clear OLD validation results (fixes duplication)
    const valList = document.getElementById('validationList');
    valList.innerHTML = '';
    
    const originalFileName = currentFileName;

    // 1. Auto-rename file to MAX(VERSION) + 1
    let nextVersionObj = calculateNextVersion(maxVersionString);
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
            
            // --- NEW: CALC DIFF & RENDER ---
            const diffDisplay = document.getElementById('fixedSqlDisplay');
            const diff = Diff.diffWords(currentSqlContent, data.fixed_sql);
            
            diffDisplay.innerHTML = ''; // clear
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.className = 'diff-content';
            
            diff.forEach((part) => {
                const span = document.createElement('span');
                if (part.added) span.className = 'diff-added';
                if (part.removed) span.className = 'diff-removed';
                span.appendChild(document.createTextNode(part.value));
                code.appendChild(span);
            });
            
            pre.appendChild(code);
            diffDisplay.appendChild(pre);
            // --------------------------------

            currentSqlContent = data.fixed_sql;
            
            // Re-validate UI
            addValidationItem(`Formatting validated with sqlfluff (Oracle dialect).`, 'icon-green');


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
                // --- MODAL TRIGGER INSTEAD OF PROMPT ---
                document.getElementById('subversionModal').style.display = 'flex';
                document.getElementById('subversionInput').focus();
                
                // Store state for modal callback
                window._pendingFixData = { finalSql, fixBtn };
                return; // Wait for modal
            }

            if (data.lint_issues && data.lint_issues.length > 0) {
                // Store issues for the modal callback
                window._pendingFixLintIssues = data.lint_issues;
            } else {
                window._pendingFixLintIssues = [];
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
    // Safety check for filename
    if (!currentFileName || currentFileName === "No file chosen") {
        currentFileName = "migration.sql";
    }
    if (!currentFileName.toLowerCase().endsWith('.sql')) {
        currentFileName += '.sql';
    }

    // 1. Download file via stable blob method
    try {
        const blob = new Blob([currentSqlContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFileName;
        document.body.appendChild(a);
        a.click();
        
        // Minor delay before cleanup to ensure trigger
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    } catch (e) {
        console.error("Download failed", e);
    }

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
// Add this at the end of app.js
async function notifyTeams() {
    const objectSelect = document.getElementById('objectSelect');
    const notifyBtn = document.getElementById('notifyTeamsBtn');

    // 1. Get the raw value
    let objectName = objectSelect.value;

    // 2. DEBUG: See what the browser is actually seeing
    console.log("DEBUG: Raw Select Value is:", objectName);

    // 3. Fallback: If value is empty, try the text of the selected option
    if (!objectName && objectSelect.selectedIndex >= 0) {
        objectName = objectSelect.options[objectSelect.selectedIndex].text;
        console.log("DEBUG: Using Fallback Text:", objectName);
    }

    // 4. Clean the name (removes [PACKAGE] etc.)
    const cleanName = objectName.replace(/^\[.*?\]\s*/, '').trim();
    console.log("DEBUG: Final Cleaned Name being sent:", cleanName);

    if (!cleanName || cleanName === "" || cleanName.includes("-- Select")) {
        alert("⚠️ Please select a database object first!");
        return;
    }

    const originalText = notifyBtn.textContent;
    notifyBtn.textContent = "🚀 Sending...";
    notifyBtn.disabled = true;

    try {
        const response = await fetch('/api/notify_working', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ "object_name": cleanName })
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ Success: Teams notified for ${cleanName}`);
        } else {
            alert(`❌ Server Error: ${data.error}`);
        }
    } catch (err) {
        console.error('Fetch Error:', err);
        alert(`🔌 Network Error: ${err.message}`);
        notifyBtn.textContent = originalText;
        notifyBtn.disabled = false;
    }
}

function onSubversionConfirm() {
    const subInput = document.getElementById('subversionInput');
    const subversion = subInput.value.trim() || '1';
    const modal = document.getElementById('subversionModal');
    
    if (window._pendingFixData) {
        const { finalSql, fixBtn } = window._pendingFixData;
        
        currentFileName = generateMigrationFilename(finalSql, currentFileName, maxVersionString, subversion);
        currentSqlContent = finalSql;
        document.getElementById('uploadFileName').textContent = currentFileName;

        addValidationItem(`Formatting validated with sqlfluff (Oracle dialect).`, 'icon-green');
        const displayName = currentFileName.replace(/\.sql$/i, '');
        addValidationItem(`File renamed to ${displayName}`, 'icon-green');

        if (window._pendingFixLintIssues && window._pendingFixLintIssues.length > 0) {
             addValidationItem(`Syntax/Lint checker found ${window._pendingFixLintIssues.length} issues.`, 'icon-red');
        } else {
             addValidationItem(`No syntax issues found according to sqlfluff!`, 'icon-green');
             addValidationItem(`Ready to deploy!`, 'icon-green', true);
             updateStepper(3);
             document.getElementById('confirmBtn').disabled = false;
        }

        fixBtn.textContent = 'Fix Issues';
        fixBtn.disabled = false;
        modal.style.display = 'none';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    
    updateThemeIcons(target);
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    updateThemeIcons(saved);
}

function updateThemeIcons(theme) {
    const sun = document.getElementById('theme-icon-sun');
    const moon = document.getElementById('theme-icon-moon');
    if (theme === 'dark') {
        sun.style.display = 'block';
        moon.style.display = 'none';
    } else {
        sun.style.display = 'none';
        moon.style.display = 'block';
    }
}