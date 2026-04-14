const crypto = require('crypto');

function generateETag(task) {
    if (!task) {
        return null;
    }

    const content = JSON.stringify({
        id: task.id,
        uid: task.uid,
        updated_at: task.updated_at,
        completed_at: task.completed_at,
        status: task.status,
    });

    const hash = crypto.createHash('md5').update(content).digest('hex');

    return `"${hash}"`;
}

function generateCTag() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    return `"${timestamp}-${random}"`;
}

function parseETag(etagHeader) {
    if (!etagHeader) {
        return null;
    }

    return etagHeader.replace(/^["']|["']$/g, '');
}

function matchesETag(etag1, etag2) {
    if (!etag1 || !etag2) {
        return false;
    }

    const clean1 = parseETag(etag1);
    const clean2 = parseETag(etag2);

    return clean1 === clean2;
}

module.exports = {
    generateETag,
    generateCTag,
    parseETag,
    matchesETag,
};
