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

    const hash = crypto.createHash('sha256').update(content).digest('hex');

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

// If-Match takes entity-tags, and the quotes are part of the tag (RFC 9110
// 8.8.3). ETags are stored without them, so add them back for the header. A
// weak tag is left as it is: it keeps its W/ prefix and never matches a
// strong comparison.
function formatEntityTag(etag) {
    if (!etag) {
        return null;
    }

    if (/^W\//i.test(etag)) {
        return etag;
    }

    return `"${parseETag(etag)}"`;
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
    formatEntityTag,
    matchesETag,
};
