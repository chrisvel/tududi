/**
 * MCP tool executor: runs tools by sending an internal HTTP request to the Express API.
 * Reuses the same route handlers, auth, and business logic as the REST API.
 * - In production/Docker: uses Node's built-in http to request localhost (no supertest).
 * - In tests: uses supertest when available so no real server is needed.
 */

const http = require('http');
const { getRegistry } = require('./registry');

let supertestRequest;
function getSupertest() {
    if (supertestRequest !== undefined) return supertestRequest;
    try {
        supertestRequest = require('supertest');
    } catch {
        supertestRequest = null;
    }
    return supertestRequest;
}

/**
 * Build request path from template (e.g. /api/v1/task/{uid}) and args (e.g. { uid: 'abc-123' }).
 */
function buildPath(pathTemplate, args) {
    let path = pathTemplate;
    const byName = getRegistry().byName;
    for (const [toolName, meta] of byName) {
        if (meta.path !== pathTemplate) continue;
        for (const param of meta.pathParamNames) {
            const value = args[param];
            if (value !== undefined && value !== null) {
                path = path.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
            }
        }
        break;
    }
    return path;
}

/**
 * Make an HTTP request to the same server (localhost) and return status + parsed body.
 */
function internalHttpRequest(port, method, path, authHeader, body) {
    return new Promise((resolve, reject) => {
        const pathWithQuery = path.startsWith('/') ? path : `/${path}`;
        const opts = {
            hostname: '127.0.0.1',
            port,
            path: pathWithQuery,
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        };
        if (authHeader) opts.headers.Authorization = authHeader;

        const req = http.request(opts, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let bodyOut = null;
                try {
                    bodyOut = raw ? JSON.parse(raw) : null;
                } catch {
                    bodyOut = raw || null;
                }
                resolve({ statusCode: res.statusCode, body: bodyOut });
            });
        });
        req.on('error', reject);

        if (body != null && ['POST', 'PUT', 'PATCH'].includes(method)) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

/**
 * Execute an MCP tool by name with the given arguments.
 * @param {string} toolName - MCP tool name (e.g. tasks_list, task_create)
 * @param {object} args - Tool arguments (path params, query params, body)
 * @param {object} context - { app?, authHeader, serverPort? } (serverPort from req.socket.server.address().port)
 * @returns {Promise<{ content: Array<{ type: 'text', text: string }>, isError?: boolean, structuredContent?: object }>}
 */
async function executeTool(toolName, args, context) {
    const { app, authHeader, serverPort } = context;
    const { byName } = getRegistry();
    const meta = byName.get(toolName);

    if (!meta) {
        return {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
        };
    }

    const argsObj = args && typeof args === 'object' ? args : {};
    let path = meta.path;
    for (const param of meta.pathParamNames) {
        const value = argsObj[param];
        if (value === undefined || value === null) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Missing required path parameter: ${param}`,
                    },
                ],
                isError: true,
            };
        }
        path = path.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
    }

    const queryKeys = meta.pathParamNames.reduce((acc, p) => {
        acc[p] = true;
        return acc;
    }, {});
    const queryParams = {};
    const bodyParams = {};
    for (const [key, value] of Object.entries(argsObj)) {
        if (key.startsWith('_') && key.length === 1) continue;
        if (queryKeys[key]) continue;
        if (['GET', 'DELETE'].includes(meta.method)) {
            queryParams[key] = value;
        } else {
            bodyParams[key] = value;
        }
    }

    const queryString = new URLSearchParams(
        Object.entries(queryParams).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    const pathWithQuery = queryString ? `${path}?${queryString}` : path;

    let response;

    const request = getSupertest();
    if (request && app) {
        try {
            let req = request(app)[meta.method.toLowerCase()](pathWithQuery).set(
                'Authorization',
                authHeader || ''
            );
            if (['POST', 'PUT', 'PATCH'].includes(meta.method) && Object.keys(bodyParams).length > 0) {
                req = req.send(bodyParams);
            }
            const res = await req;
            response = { statusCode: res.statusCode, body: res.body };
        } catch (err) {
            return {
                content: [{ type: 'text', text: (err && err.message) || String(err) }],
                isError: true,
            };
        }
    } else {
        const port = serverPort || Number(process.env.PORT) || 3002;
        try {
            response = await internalHttpRequest(
                port,
                meta.method,
                pathWithQuery,
                authHeader || '',
                ['POST', 'PUT', 'PATCH'].includes(meta.method) && Object.keys(bodyParams).length > 0
                    ? bodyParams
                    : undefined
            );
        } catch (err) {
            return {
                content: [{ type: 'text', text: (err && err.message) || String(err) }],
                isError: true,
            };
        }
    }

    const isError = response.statusCode >= 400;
    const body =
        typeof response.body === 'object' && response.body !== null
            ? response.body
            : { message: response.body };

    const text =
        typeof body === 'string' ? body : JSON.stringify(body, null, 2);

    const result = {
        content: [{ type: 'text', text }],
        isError,
    };

    if (!isError && typeof body === 'object' && body !== null && !Array.isArray(body)) {
        result.structuredContent = body;
    }

    return result;
}

module.exports = {
    executeTool,
    buildPath,
};
