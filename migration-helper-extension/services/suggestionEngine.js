/**
 * Suggestion engine for filenames and descriptions based on SQL content.
 */

/**
 * Generates a description string based on SQL content.
 * @param {string} sqlContent 
 * @returns {string} Suggested description
 */
function suggestDescription(sqlContent) {
    const normalized = sqlContent.toLowerCase().trim();
    // Simple parsing for DDL
    let match = normalized.match(/create\s+table\s+([a-z0-9_]+)/i);
    if (match) return `create_${match[1]}_table`;

    match = normalized.match(/alter\s+table\s+([a-z0-9_]+)/i);
    if (match) return `alter_${match[1]}_table`;

    match = normalized.match(/drop\s+table\s+([a-z0-9_]+)/i);
    if (match) return `drop_${match[1]}_table`;

    // Simple parsing for DML
    match = normalized.match(/insert\s+into\s+([a-z0-9_]+)/i);
    if (match) return `insert_${match[1]}`;

    match = normalized.match(/update\s+([a-z0-9_]+)/i);
    if (match) return `update_${match[1]}`;

    match = normalized.match(/delete\s+from\s+([a-z0-9_]+)/i);
    if (match) return `delete_${match[1]}`;

    // Simple parsing for Repeatable
    match = normalized.match(/create\s+(?:procedure|function)\s+([a-z0-9_]+)/i);
    if (match) return `create_${match[1]}`;

    return 'migration';
}

/**
 * Suggests a valid filename based on required version and SQL content.
 * @param {number} version 
 * @param {number} subversion 
 * @param {string} sqlContent 
 * @returns {string} Suggested filename
 */
function suggestCorrectFilename(version, subversion, sqlContent) {
    const description = suggestDescription(sqlContent);
    return `V${version}_${subversion}__${description}.sql`;
}

module.exports = {
    suggestDescription,
    suggestCorrectFilename
};
