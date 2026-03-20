/**
 * Validates the file name and parses version components.
 */

const NamingRegex = /^V(\d+)_(\d+)__(.+)\.sql$/;

/**
 * Validates if a filename matches the required convention.
 * @param {string} filename 
 * @returns {boolean}
 */
function isValidFilename(filename) {
    return NamingRegex.test(filename);
}

/**
 * Parses the version, subversion, and description from a valid filename.
 * @param {string} filename 
 * @returns {{version: number, subversion: number, description: string}|null}
 */
function parseFilename(filename) {
    const match = filename.match(NamingRegex);
    if (!match) return null;

    return {
        version: parseInt(match[1], 10),
        subversion: parseInt(match[2], 10),
        description: match[3]
    };
}

module.exports = {
    isValidFilename,
    parseFilename
};
