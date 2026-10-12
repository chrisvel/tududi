'use strict';

// Life-to-Day (T-706): what the user controls about MCP access (blueprint
// 17.6): read-only mode, the kill switch, per-client revocation and the
// writes_disabled state set after repeated rate-limit violations.
const { LtdMcpSetting, ApiToken } = require('../../models');
const oauthStore = require('../ltd-oauth/store');
const { forgetToken } = require('../users/apiTokenService');
const { NotFoundError, ValidationError } = require('../../shared/errors');

const SCOPES = ['ltd.read', 'ltd.write', 'ltd.propose'];
const TOUCH_MS = 5 * 60 * 1000;
const decode = (value) =>
    typeof value === 'string' ? JSON.parse(value) : value;

async function settings(userId) {
    const row = await LtdMcpSetting.findByPk(userId);
    return {
        read_only: !!row?.read_only,
        tokens_revoked_at: row?.tokens_revoked_at || null,
        clients: decode(row?.clients) || {},
    };
}

async function save(userId, changes) {
    const [row] = await LtdMcpSetting.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId },
    });
    await row.update(changes);
    return settings(userId);
}

async function patchClient(userId, key, patch) {
    const { clients } = await settings(userId);
    const next = { ...clients };
    if (patch === null) delete next[key];
    else next[key] = { ...next[key], ...patch };
    return save(userId, { clients: next });
}

// The client behind this MCP request. Session and API-token callers hold
// every scope (personal, full-trust credentials); OAuth clients hold what
// the user granted them.
async function resolveClient(req) {
    const userId = req.currentUser.id;
    const state = await settings(userId);
    let client;
    if (req.ltdOauth) {
        client = {
            kind: 'oauth',
            key: `oauth:${req.ltdOauth.client_id}`,
            scopes: req.ltdOauth.scopes,
            issued_at: new Date(req.ltdOauth.iat * 1000),
        };
    } else if (req.authToken) {
        client = {
            kind: 'token',
            key: `token:${req.authToken.id}`,
            label: req.authToken.name,
            scopes: SCOPES,
            issued_at: new Date(req.authToken.created_at),
        };
    } else {
        client = { kind: 'session', key: 'session', scopes: SCOPES };
    }
    client.revoked =
        client.kind !== 'session' &&
        !!state.tokens_revoked_at &&
        client.issued_at <= new Date(state.tokens_revoked_at);
    client.readOnly = state.read_only;
    client.writesDisabled = !!state.clients[client.key]?.writes_disabled_at;
    const seen = state.clients[client.key]?.last_used_at;
    if (
        !client.revoked &&
        client.kind !== 'session' &&
        (!seen || Date.now() - new Date(seen) > TOUCH_MS)
    ) {
        patchClient(userId, client.key, {
            kind: client.kind,
            label: client.label || null,
            last_used_at: new Date().toISOString(),
        }).catch(() => {});
    }
    return client;
}

async function listClients(userId) {
    const state = await settings(userId);
    const oauth = (await oauthStore.clientsFor(userId)).map((client) => ({
        key: `oauth:${client.client_id}`,
        kind: 'oauth',
        ...client,
    }));
    const keys = new Set(oauth.map((client) => client.key));
    const others = Object.entries(state.clients)
        .filter(([key]) => !keys.has(key))
        .map(([key, value]) => ({ key, kind: value.kind, name: value.label }));
    return {
        read_only: state.read_only,
        tokens_revoked_at: state.tokens_revoked_at,
        clients: [...oauth, ...others].map((client) => ({
            ...client,
            last_used_at: state.clients[client.key]?.last_used_at || null,
            writes_disabled_at:
                state.clients[client.key]?.writes_disabled_at || null,
        })),
    };
}

async function revokeClient(userId, key) {
    const [kind, id] = String(key).split(/:(.+)/);
    if (kind === 'oauth') {
        if (!(await oauthStore.revokeGrants(userId, id)))
            throw new NotFoundError('Client not found');
    } else if (kind === 'token' && /^\d+$/.test(id)) {
        const token = await ApiToken.findOne({
            where: { id: Number(id), user_id: userId },
        });
        if (!token) throw new NotFoundError('Client not found');
        forgetToken(token.id);
        if (!token.revoked_at) await token.update({ revoked_at: new Date() });
    } else {
        throw new ValidationError('Unknown client');
    }
    await patchClient(userId, key, null);
    return listClients(userId);
}

// Kill switch: every OAuth grant goes, and every token issued until now
// stops working on /api/mcp. API tokens keep working for the REST API.
async function killSwitch(userId) {
    await oauthStore.revokeGrants(userId);
    await save(userId, { tokens_revoked_at: new Date(), clients: {} });
    return listClients(userId);
}

async function setReadOnly(userId, on) {
    if (typeof on !== 'boolean')
        throw new ValidationError('on must be true or false');
    await save(userId, { read_only: on });
    return listClients(userId);
}

const disableWrites = (userId, key) =>
    patchClient(userId, key, { writes_disabled_at: new Date().toISOString() });

async function enableWrites(userId, key) {
    await patchClient(userId, key, { writes_disabled_at: null });
    return listClients(userId);
}

module.exports = {
    SCOPES,
    settings,
    resolveClient,
    listClients,
    revokeClient,
    killSwitch,
    setReadOnly,
    disableWrites,
    enableWrites,
};
