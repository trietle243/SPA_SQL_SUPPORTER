/**
 * Detects the type of SQL migration.
 */

/**
 * Detects SQL type based on content.
 * @param {string} sqlContent 
 * @returns {string} DDL, DML, Repeatable, or Unknown
 */
function detectSqlType(sqlContent) {
    const normalized = sqlContent.toLowerCase().replace(/\s+/g, ' ');

    // Rule: Repeatable
    if (normalized.includes('create procedure') || normalized.includes('create function')) {
        return 'Repeatable';
    }

    // Rule: DDL
    if (normalized.includes('create table') || normalized.includes('alter table') || normalized.includes('drop table')) {
        return 'DDL';
    }

    // Rule: DML
    if (normalized.includes('insert ') || normalized.includes('insert into ') || normalized.includes('update ') || normalized.includes('delete from ') || normalized.includes('delete ')) {
        return 'DML';
    }

    return 'Unknown';
}

module.exports = {
    detectSqlType
};
