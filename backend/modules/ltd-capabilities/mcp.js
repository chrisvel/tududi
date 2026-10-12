'use strict';

// Life-to-Day (T-703): MCP tools built from the Capability Registry.
const { jsonSchema, SCOPES } = require('./registry');
const { run } = require('./guard');
const { CAPABILITIES } = require('./catalog');

// A caller without client details (stdio, unit tests) is a personal token.
const clientOf = (context) =>
    context.client || {
        kind: 'token',
        key: context.apiToken?.id ? `token:${context.apiToken.id}` : 'token',
        scopes: SCOPES,
    };

function toMcpTool(capability, context) {
    const client = clientOf(context);
    const ctx = {
        user: context.user,
        userId: context.userId,
        client,
        actor: {
            user_id: context.userId,
            actor_type: 'mcp',
            actor_id: client.key,
        },
    };
    return {
        name: capability.name,
        description: capability.description,
        inputSchema: jsonSchema(capability),
        annotations: {
            readOnlyHint: !capability.writes,
            destructiveHint: false,
        },
        scope: capability.scope,
        risk: capability.risk,
        handler: (args) => run(capability, args, ctx),
    };
}

// Only the tools this client's scopes allow are listed.
function registerCapabilities(context, tools, capabilities = CAPABILITIES) {
    const { scopes } = clientOf(context);
    for (const capability of capabilities) {
        if (scopes.includes(capability.scope))
            tools.push(toMcpTool(capability, context));
    }
}

module.exports = { registerCapabilities, toMcpTool, clientOf };
