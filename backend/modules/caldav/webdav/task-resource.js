// Resolving a CalDAV resource URL: which task it names, and whether the caller
// may see it. RFC 4791 5.3.2 makes those one question - a resource name is
// arbitrary and only unique to the client that chose it, so the lookup has to
// be scoped or another user's row answers for someone else's URL.

const taskRepository = require('../../tasks/repository');
const { CALDAV_TASK_INCLUDES } = require('../task-includes');
const { visibleTaskWhere } = require('../access');

const EXTENSION = /\.ics$/i;
// The last path segment of an href, which is what names the resource.
const OBJECT_HREF = /\/([^/]+)\.ics$/i;

// From a route parameter, which Express has already decoded.
function resourceNameFromParam(segment) {
    return String(segment || '').replace(EXTENSION, '');
}

// From a <D:href> in a request body, which is still URL-encoded. Null when the
// href does not name a calendar object resource.
function resourceNameFromHref(href) {
    const match = String(href || '').match(OBJECT_HREF);
    return match ? decodeURIComponent(match[1]) : null;
}

// The task a resource names, or null when this caller cannot see one.
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
