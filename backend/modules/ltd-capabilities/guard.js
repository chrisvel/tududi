'use strict';

// Life-to-Day (T-705): the safety contract around every capability call
// (blueprint 17.4, ported in spirit from dayGLANCE): scope, read-only mode,
// writes_disabled, idempotency_key replay, 30 writes a minute per client,
// and an access log that keeps an argument hash, never the text.
const crypto = require('crypto');
const { CapabilityError } = require('./registry');
const idempotency = require('../ltd-idempotency/repository');
const control = require('../ltd-mcp-control/service');
const { logger } = require('../../services/logService');

const WINDOW_MS = 60 * 1000;
const MAX_WRITES = 30;
const STRIKES = 3;
const STRIKE_WINDOW_MS = 10 * 60 * 1000;

// ponytail: counters live in this process; one Node process serves the app
// today. Several processes would need the counters in the database.
const writes = new Map();
const strikes = new Map();

const recent = (map, key, windowMs, now) =>
    (map.get(key) || []).filter((at) => now - at < windowMs);

// Returns false when the client is over its write budget. The third
// violation within ten minutes turns the client's writes off until the user
// turns them back on in Settings.
async function takeWrite(userId, clientKey, now = Date.now()) {
    const key = `${userId}:${clientKey}`;
    const list = recent(writes, key, WINDOW_MS, now);
    if (list.length < MAX_WRITES) {
        writes.set(key, [...list, now]);
        return true;
    }
    writes.set(key, list);
    const hits = [...recent(strikes, key, STRIKE_WINDOW_MS, now), now];
    strikes.set(key, hits);
    if (hits.length >= STRIKES) {
        strikes.delete(key);
        await control.disableWrites(userId, clientKey);
    }
    return false;
}

const ERROR_CODES = {
    ValidationError: 'validation',
    NotFoundError: 'not_found',
    ConflictError: 'conflict',
    ForbiddenError: 'forbidden',
};

const result = (value) => ({
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});
const failure = (code, message) => ({
    content: [
        { type: 'text', text: JSON.stringify({ error: { code, message } }) },
    ],
    isError: true,
});

async function guarded(capability, args, ctx) {
    const { client } = ctx;
    if (!client.scopes.includes(capability.scope))
        throw new CapabilityError(
            'insufficient_scope',
            `This client was not granted ${capability.scope}`
        );
    const parsed = capability.input.safeParse(args ?? {});
    if (!parsed.success)
        throw new CapabilityError(
            'validation',
            parsed.error.issues
                .map(
                    (issue) =>
                        `${issue.path.join('.') || 'input'}: ${issue.message}`
                )
                .join('; ')
        );
    const { idempotency_key: key, ...input } = parsed.data;
    if (!capability.writes) return capability.handler(input, ctx);

    if (client.readOnly)
        throw new CapabilityError(
            'read_only',
            'Life-to-Day is in read-only mode for MCP; the user can turn it off in Settings'
        );
    if (client.writesDisabled)
        throw new CapabilityError(
            'writes_disabled',
            'Writes are off for this client after repeated rate-limit violations; the user can turn them back on in Settings'
        );
    const storeKey = key && `mcp:${capability.name}:${key}`;
    if (storeKey) {
        const stored = await idempotency.findByKeyAndUser(storeKey, ctx.userId);
        if (stored)
            return { ...JSON.parse(stored.response), idempotent_replay: true };
    }
    if (!(await takeWrite(ctx.userId, client.key)))
        throw new CapabilityError(
            'rate_limited',
            `At most ${MAX_WRITES} writes a minute; wait and retry`
        );
    const value = await capability.handler(input, ctx);
    if (storeKey)
        await idempotency.saveResult({
            key: storeKey,
            userId: ctx.userId,
            method: 'MCP',
            path: capability.name,
            status: 200,
            response: value,
        });
    return value;
}

// Runs a capability and turns the outcome into an MCP tool result.
async function run(capability, args, ctx) {
    const started = Date.now();
    let code = null;
    try {
        return result(await guarded(capability, args, ctx));
    } catch (error) {
        code =
            error instanceof CapabilityError
                ? error.code
                : ERROR_CODES[error.name] || 'internal';
        return failure(
            code,
            code === 'internal' ? 'Something went wrong' : error.message
        );
    } finally {
        logger.info(
            {
                mcp: {
                    tool: capability.name,
                    client: ctx.client.key,
                    user: ctx.userId,
                    args: crypto
                        .createHash('sha256')
                        .update(JSON.stringify(args ?? {}))
                        .digest('hex')
                        .slice(0, 16),
                    ok: code === null,
                    code,
                    ms: Date.now() - started,
                },
            },
            'mcp tool call'
        );
    }
}

function resetLimits() {
    writes.clear();
    strikes.clear();
}

module.exports = { run, takeWrite, resetLimits, MAX_WRITES, STRIKES };
