const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

/**
 * Reads the migration log Excel file and finds the latest version and subversion.
 * @param {string} workspaceRoot The root path of the workspace.
 * @returns {{version: number, subversion: number}|null} The latest version object or null if not found.
 */
function getLatestMigrationVersion(workspaceRoot) {
    if (!workspaceRoot) return null;

    const excelFilePath = path.join(workspaceRoot, 'data', 'migration_log.xlsx');

    if (!fs.existsSync(excelFilePath)) {
        vscode.window.showWarningMessage(`Excel file not found at: ${excelFilePath}`);
        return null;
    }

    try {
        const workbook = xlsx.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let latestVersion = 0;
        let latestSubversion = 0;

        for (const row of data) {
            const v = parseInt(row['Version'], 10);
            const sv = parseInt(row['Subversion'], 10);

            if (!isNaN(v) && !isNaN(sv)) {
                if (v > latestVersion) {
                    latestVersion = v;
                    latestSubversion = sv;
                } else if (v === latestVersion && sv > latestSubversion) {
                    latestSubversion = sv;
                }
            }
        }

        return {
            version: latestVersion,
            subversion: latestSubversion
        };
    } catch (error) {
        vscode.window.showErrorMessage(`Error reading Excel file: ${error.message}`);
        return null;
    }
}

module.exports = {
    getLatestMigrationVersion
};
