'use strict';

// Life-to-Day (T-703): the Capability Registry (blueprint 16.2). Each
// capability is defined once (name, zod input, scope, risk tier, handler);
// the MCP server builds its tools from these definitions and the in-app
// assistant (Phase 8) will build its tools from the same list.
const { z } = require('zod');

const SCOPES = ['ltd.read', 'ltd.write', 'ltd.propose'];
// The scope each risk tier needs (blueprint 16.3).
const SCOPE_FOR_RISK = {
    R0: 'ltd.read',
    R1: 'ltd.write',
    R2: 'ltd.propose',
    R3: 'ltd.propose',
};

// Typed error codes (blueprint 17.4) that reach the model as tool results.
class CapabilityError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const idempotencyKey = z
    .string()
    .min(1)
    .max(200)
    .regex(/^[\x21-\x7e]+$/)
    .optional()
    .describe(
        'Optional. Repeating a call with the same key returns the first result instead of writing again.'
    );

function define({ name, description, scope, risk, input, handler }) {
    if (!/^[a-z][a-z0-9_]*$/.test(name))
        throw new Error(`Invalid capability name: ${name}`);
    // No capability hard-deletes (ADR-007, blueprint 16.3).
    if (/(^|_)(delete|remove|destroy|purge)(_|$)/.test(name))
        throw new Error(`Capabilities never hard-delete: ${name}`);
    if (SCOPE_FOR_RISK[risk] !== scope)
        throw new Error(
            `${name}: risk ${risk} needs scope ${SCOPE_FOR_RISK[risk]}`
        );
    if (!(input instanceof z.ZodObject))
        throw new Error(`${name}: input must be a zod object`);
    if (typeof description !== 'string' || !description)
        throw new Error(`${name}: description is required`);
    const writes = risk !== 'R0';
    return Object.freeze({
        name,
        description,
        scope,
        risk,
        writes,
        input: writes
            ? input.extend({ idempotency_key: idempotencyKey })
            : input,
        handler,
    });
}

// The JSON Schema MCP clients see, without the draft marker.
function jsonSchema(capability) {
    // eslint-disable-next-line no-unused-vars
    const { $schema, ...schema } = z.toJSONSchema(capability.input, {
        io: 'input',
    });
    return schema;
}

module.exports = {
    z,
    SCOPES,
    SCOPE_FOR_RISK,
    CapabilityError,
    define,
    jsonSchema,
};
