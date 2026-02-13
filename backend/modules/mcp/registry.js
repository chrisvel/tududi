/**
 * MCP tool registry: builds tool list from Swagger/OpenAPI spec.
 * Only includes authenticated API operations (excludes login, register, etc.).
 */

const swaggerSpec = require('../../config/swagger');

const API_BASE_PATH = swaggerSpec.API_BASE_PATH || '/api/v1';

const SKIP_PATH_SUFFIXES = [
    'areas',
    'areas/{uid}',
    'current_user',
    'login',
    'logout',
    'profile',
    'profile/api-keys',
    'profile/api-keys/{id}',
    'profile/api-keys/{id}/revoke',
    'tasks/generate-recurring',
    'tasks/metrics',
    'version',
];

const SKIP_PATHS = SKIP_PATH_SUFFIXES.map((s) => `${API_BASE_PATH}/${s}`);

const METHOD_TO_ACTION = {
    get: 'get',
    post: 'create',
    put: 'update',
    patch: 'update',
    delete: 'delete',
};

/**
 * Convert OpenAPI path and method to a stable MCP tool name (alphanumeric, underscore).
 * e.g. /api/v1/tasks + get -> tasks_list, /api/v1/task/{uid} + get -> task_get
 */
function pathMethodToToolName(path, method) {
    const base = path.replace(/^\/api(\/v\d+)?/, '') || '/';
    const segments = base.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'item';
    const isParam = last.startsWith('{');
    const resource = isParam ? segments[segments.length - 2] || last : last;
    const action = METHOD_TO_ACTION[method.toLowerCase()] || method.toLowerCase();
    const listName = resource.replace(/s$/, '') + 's';
    const suffix =
        action === 'get' && !isParam
            ? 'list'
            : action === 'get' && isParam
              ? 'get'
              : action;
    const name = isParam ? `${resource}_${suffix}` : `${listName}_${suffix}`;
    return name.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Build JSON Schema for tool input from OpenAPI parameters and requestBody.
 * @param {object} operation - OpenAPI operation object
 * @param {{ method?: string }} opts - Optional; method used to set additionalProperties: false for write operations
 */
function buildInputSchema(operation, opts = {}) {
    const properties = {};
    const required = [];

    const params = operation.parameters || [];
    for (const p of params) {
        const name = p.name;
        if (!name) continue;
        properties[name] = {
            type: p.schema?.type || 'string',
            description: p.description || undefined,
            enum: p.schema?.enum,
        };
        if (p.required) required.push(name);
    }

    const body = operation.requestBody?.content?.['application/json']?.schema;
    const hasRequestBody = !!body?.properties;
    if (body && body.properties) {
        for (const [key, prop] of Object.entries(body.properties)) {
            if (properties[key]) continue;
            const propSchema = {
                type: prop.type || 'string',
                description: prop.description,
                enum: prop.enum,
                format: prop.format,
            };
            if (prop.items) propSchema.items = prop.items;
            if (prop.additionalProperties !== undefined) propSchema.additionalProperties = prop.additionalProperties;
            properties[key] = propSchema;
        }
        if (Array.isArray(body.required)) {
            for (const r of body.required) {
                if (!required.includes(r)) required.push(r);
            }
        }
    }

    const method = (opts.method || '').toUpperCase();
    const isWriteOp = ['POST', 'PUT', 'PATCH'].includes(method) && hasRequestBody;

    return {
        type: 'object',
        properties: Object.keys(properties).length ? properties : { _: { type: 'string', description: 'Unused' } },
        required: required.length ? required : undefined,
        additionalProperties: isWriteOp ? false : true,
    };
}

/**
 * Extract path parameter names from OpenAPI path string (e.g. /task/{uid} -> ['uid']).
 */
function getPathParamNames(path) {
    const names = [];
    const re = /\{(\w+)\}/g;
    let m;
    while ((m = re.exec(path)) !== null) names.push(m[1]);
    return names;
}

/**
 * Load overlay and return overrides for (path, method). Overlay is keyed by path then method.
 */
function getOverlayEntry(path, method) {
    try {
        const overlay = require('./tools.overlay');
        const pathEntry = overlay[path];
        if (!pathEntry) return null;
        return pathEntry[method] || pathEntry[method.toUpperCase()] || null;
    } catch {
        return null;
    }
}

/**
 * Build the list of MCP tools from the Swagger spec, then apply declarative overlay.
 * @returns {{ tools: Array<{ name, description, inputSchema }>, byName: Map<string, { method, path, pathParamNames }> }}
 */
function buildToolRegistry() {
    const paths = swaggerSpec?.paths || {};
    const tools = [];
    const byName = new Map();

    for (const [path, pathItem] of Object.entries(paths)) {
        if (SKIP_PATHS.some((skip) => path === skip || path.endsWith(skip))) continue;

        const pathParamNames = getPathParamNames(path);

        for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
            const op = pathItem[method];
            if (!op) continue;

            const methodUpper = method.toUpperCase();
            const derivedName = pathMethodToToolName(path, method);
            let description =
                op.summary || op.description || `${methodUpper} ${path}`;
            let inputSchema = buildInputSchema(op, { method: methodUpper });

            const overlayEntry = getOverlayEntry(path, methodUpper);
            let name = derivedName;
            if (overlayEntry) {
                if (overlayEntry.name != null) name = overlayEntry.name;
                if (overlayEntry.description != null) description = overlayEntry.description;
                if (overlayEntry.inputSchema != null) inputSchema = overlayEntry.inputSchema;
            }

            tools.push({
                name,
                description,
                inputSchema,
            });

            byName.set(name, {
                method: methodUpper,
                path,
                pathParamNames,
                requestBody: !!op.requestBody,
            });
        }
    }

    return { tools, byName };
}

let cached;

function getRegistry() {
    if (!cached) cached = buildToolRegistry();
    return cached;
}

module.exports = {
    getRegistry,
    pathMethodToToolName,
    buildInputSchema,
};
