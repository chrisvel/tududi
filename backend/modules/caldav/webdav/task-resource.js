// One place that answers "which task does this URL name?".
//
// A CalDAV calendar object resource has two names: the UID inside the VTODO,
// which is the task's identity, and the resource name it was uploaded under,
// which is its URL. RFC 4791 5.3.2 says the URL is arbitrary and need not
// match the UID, so every request that carries one - GET, PUT, DELETE, the item
// PROPFIND and both multigets - has to resolve it the same way.
//
// It also has to resolve it *inside what the caller can see*. A resource name
// is only unique to the client that chose it, so another user's task can carry
// the same string; without a scope, one user's row answers for another user's
// URL and the legitimate owner gets a 404 (or is refused a write) on their own
// task. Keeping both halves of that in these three functions is what stops the
// handlers drifting apart, which is how the item PROPFIND and the project
// multiget came to answer 404 on hrefs this very server had just handed out.

const taskRepository = require('../../tasks/repository');
const { CALDAV_TASK_INCLUDES } = require('../task-includes');
const { visibleTaskWhere } = require('../access');

const EXTENSION = /\.ics$/i;
// The last path segment of an href, which is what names the resource.
const OBJECT_HREF = /\/([^/]+)\.ics$/i;

// A URL segment taken from a route parameter, which Express has already
// decoded.
function resourceNameFromParam(segment) {
    return String(segment || '').replace(EXTENSION, '');
}

// The same, from a <D:href> in a request body, which is still URL-encoded.
// Answers null when the href does not name a calendar object resource.
function resourceNameFromHref(href) {
    const match = String(href || '').match(OBJECT_HREF);
    return match ? decodeURIComponent(match[1]) : null;
}

// The task a resource names, or null when no such task exists for this caller.
async function findTaskResource(resourceName, userId, options = {}) {
    if (!resourceName) return null;

    const { include = CALDAV_TASK_INCLUDES, ...rest } = options;
    return await taskRepository.findByUidOrResourceName(resourceName, {
        include,
        where: await visibleTaskWhere(userId),
        ...rest,
    });
}

module.exports = {
    resourceNameFromParam,
    resourceNameFromHref,
    findTaskResource,
};
