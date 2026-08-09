// A CalDAV resource lives at a path the *creating* client chose, and only that
// client gets to choose it. tasks.org, DAVx5 and iOS Reminders all store a VTODO
// under a server- or client-generated filename that has nothing to do with its
// UID, so the href reported by the server is the only reliable way back to a
// remote object. Deriving the URL from the task uid instead reaches a resource
// that does not exist.

function normalizeHref(href) {
    if (!href || typeof href !== 'string') return null;

    const trimmed = href.trim();
    if (!trimmed) return null;

    // Absolute hrefs are legal in a multistatus response. Keeping only the path
    // means a stored href stays valid if the server_url is later edited (host
    // renamed, http -> https).
    try {
        return new URL(trimmed).pathname;
    } catch {
        return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }
}

function buildRemoteTaskUrl(remoteCalendar, remoteHref, taskUid) {
    const baseUrl = remoteCalendar.server_url.replace(/\/$/, '');

    const href = normalizeHref(remoteHref);
    if (href) {
        return `${baseUrl}${href}`;
    }

    // No href on record: the task has never been seen on this server, so Tududi
    // is the creating client and picks the filename itself.
    const calendarPath = remoteCalendar.calendar_path
        .replace(/^\//, '')
        .replace(/\/$/, '');
    return `${baseUrl}/${calendarPath}/${taskUid}.ics`;
}

function extractUidFromHref(href) {
    if (!href || typeof href !== 'string') return null;

    const match = href.match(/([^/]+)\.ics$/i);
    return match ? decodeURIComponent(match[1]) : href;
}

module.exports = {
    normalizeHref,
    buildRemoteTaskUrl,
    extractUidFromHref,
};
