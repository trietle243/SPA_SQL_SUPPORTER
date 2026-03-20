/**
 * SQL Linter integration.
 */
const { exec } = require('child_process');

/**
 * Runs SQLFluff linting on a file via CLI.
 * @param {string} filePath 
 * @returns {Promise<{success: boolean, output: string}>}
 */
function lintSqlFile(filePath) {
    return new Promise((resolve) => {
        // sqlfluff lint command
        // Note: we can't assume exactly where sqlfluff is, relying on the system PATH
        exec(`sqlfluff lint "${filePath}"`, (error, stdout, stderr) => {
            if (error) {
                // sqlfluff returns non-zero exit code if there are linting errors
                resolve({
                    success: false,
                    output: stdout || stderr || 'Linting errors found (no output details).'
                });
                return;
            }

            // Zero exit code means successful lint (or no issues)
            resolve({
                success: true,
                output: stdout || 'No lint errors'
            });
        });
    });
}

module.exports = {
    lintSqlFile
};
