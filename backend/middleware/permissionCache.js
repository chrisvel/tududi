/**
 * Request-scoped permission cache middleware
 * Caches permission lookups for the duration of a single request
 */

const permissionCache = (req, res, next) => {
    // Create a cache object scoped to this request
    req.permissionCache = new Map();

    // Clean up cache after response is sent
    res.on('finish', () => {
        req.permissionCache.clear();
    });

    next();
};

module.exports = { permissionCache };
