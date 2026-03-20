/**
 * Version validation logic.
 */

/**
 * Validates if the given version components are exactly the next ones in sequence.
 * @param {number} version 
 * @param {number} subversion 
 * @param {number} latestVersion 
 * @param {number} latestSubversion 
 * @returns {boolean}
 */
function isNextVersion(version, subversion, latestVersion, latestSubversion) {
    if (version === latestVersion) {
        return subversion === latestSubversion + 1;
    } else if (version === latestVersion + 1) {
        return subversion === 1;
    }
    return false;
}

/**
 * Suggests the next valid version string based on the latest version.
 * @param {number} latestVersion 
 * @param {number} latestSubversion 
 * @returns {{version: number, subversion: number}}
 */
function suggestNextVersion(latestVersion, latestSubversion) {
    // Assuming we continue the minor version bump. If a major bump is needed, the user should provide V<latest+1>_1.
    // By default, we suggest incrementing the subversion.
    return {
        version: latestVersion,
        subversion: latestSubversion + 1
    };
}

module.exports = {
    isNextVersion,
    suggestNextVersion
};
