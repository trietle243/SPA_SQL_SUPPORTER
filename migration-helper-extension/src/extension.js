const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { getLatestMigrationVersion } = require('../utils/excelReader');
const { isValidFilename, parseFilename } = require('../services/filenameValidator');
const { isNextVersion, suggestNextVersion } = require('../services/versionService');
const { detectSqlType } = require('../services/sqlTypeDetector');
const { suggestCorrectFilename } = require('../services/suggestionEngine');
const { lintSqlFile } = require('../services/sqlLinter');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let disposable = vscode.commands.registerCommand('migration.validate', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No file is currently open.');
            return;
        }

        const document = editor.document;
        // Verify it is SQL or if the extension matches
        const filePath = document.fileName;
        if (!filePath.toLowerCase().endsWith('.sql') && document.languageId !== 'sql') {
            vscode.window.showErrorMessage('The currently open file is not an SQL file.');
            return;
        }

        const fileName = path.basename(filePath);
        const sqlContent = document.getText();
        
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : null;

        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a workspace.');
            return;
        }

        // 1. Detect SQL Type
        const sqlType = detectSqlType(sqlContent);

        // 2. Linting
        const lintResult = await lintSqlFile(filePath);

        // 3. Name & Version Validation
        let isNamingValid = false;
        let isVersionValid = false;
        let parsed = parseFilename(fileName);
        let latestVersionObj = getLatestMigrationVersion(workspaceRoot);
        
        // Handle no excel gracefully
        if (!latestVersionObj) {
            latestVersionObj = { version: 0, subversion: 0 };
            vscode.window.showWarningMessage('Using V0_0 as baseline for validation.');
        }

        let suggestedVersion = suggestNextVersion(latestVersionObj.version, latestVersionObj.subversion);
        let suggestedFilenameStr = suggestCorrectFilename(suggestedVersion.version, suggestedVersion.subversion, sqlContent);

        if (parsed) {
            isNamingValid = true;
            isVersionValid = isNextVersion(parsed.version, parsed.subversion, latestVersionObj.version, latestVersionObj.subversion);
        } else {
            isNamingValid = false;
            isVersionValid = false;
        }

        // Output Result UI
        showWebviewReport(
            fileName,
            sqlType,
            lintResult,
            isNamingValid,
            isVersionValid,
            latestVersionObj,
            suggestedFilenameStr
        );
    });

    context.subscriptions.push(disposable);
}

const escapeHtml = (unsafe) => {
    return (unsafe || '').toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

function showWebviewReport(fileName, sqlType, lintResult, isNamingValid, isVersionValid, latestVer, suggestedFilename) {
    const panel = vscode.window.createWebviewPanel(
        'migrationValidation',
        'Migration Validation Report',
        vscode.ViewColumn.Two,
        {}
    );

    const styling = `
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; line-height: 1.6; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
            .report-box { border: 1px solid var(--vscode-editorGroup-border); padding: 15px; border-radius: 5px; }
            h1 { border-bottom: 1px solid var(--vscode-editorGroup-border); padding-bottom: 5px; }
            .label { font-weight: bold; width: 150px; display: inline-block; color: var(--vscode-editor-foreground); }
            pre { background-color: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 5px; overflow-x: auto; font-family: var(--vscode-editor-font-family); }
            .success { color: #89d185; } /* VSCode green */
            .error { color: #f48771; } /* VSCode red */
        </style>
    `;

    const namingStatus = isNamingValid ? '<span class="success">Valid</span>' : '<span class="error">Invalid</span>';
    const versionStatus = isVersionValid ? '<span class="success">Valid</span>' : '<span class="error">Invalid</span>';
    const lintStatusRaw = lintResult.success ? '<span class="success">No lint errors</span>' : '<span class="error">Linting errors found</span>';
    
    // Formatting lint output
    const formattedLintOutput = escapeHtml(lintResult.output);

    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Migration Validation Report</title>
            ${styling}
        </head>
        <body>
            <h1>Migration Validation Report</h1>
            <div class="report-box">
                <p><span class="label">File:</span> ${fileName}</p>
                <p><span class="label">SQL TYPE:</span> ${sqlType}</p>
                <br/>
                <p><span class="label">NAMING:</span> ${namingStatus}</p>
                <p><span class="label">VERSION:</span> ${versionStatus}</p>
                <p><span class="label">Latest Version:</span> V${latestVer.version}_${latestVer.subversion}</p>
                ${(!isNamingValid || !isVersionValid) ? '<p><span class="label">Suggested:</span> ' + suggestedFilename + '</p>' : ''}
                <br/>
                <p><span class="label">SQL LINT:</span> ${lintStatusRaw}</p>
                <pre>${formattedLintOutput}</pre>
            </div>
        </body>
        </html>
    `;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};;
