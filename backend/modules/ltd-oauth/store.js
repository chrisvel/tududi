'use strict';

// Life-to-Day (T-701): persistent storage for oidc-provider (its adapter
// interface) plus the queries the Clients page needs. Plain CommonJS, so the
// Clients page works without loading the ESM provider.
const { Op } = require('sequelize');
const { LtdOauthModel } = require('../../models');

const keyOf = (model, id) => `${model}:${id}`;
const decode = (value) =>
    typeof value === 'string' ? JSON.parse(value) : value;
const live = () => ({
    [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
});

class SequelizeAdapter {
    constructor(model) {
        this.model = model;
    }

    async upsert(id, payload, expiresIn) {
        await LtdOauthModel.upsert({
            key: keyOf(this.model, id),
            model: this.model,
            payload,
            grant_id: payload.grantId || null,
            uid: payload.uid || null,
            account_id: payload.accountId ? String(payload.accountId) : null,
            client_id: payload.clientId || null,
            expires_at: expiresIn
                ? new Date(Date.now() + expiresIn * 1000)
                : null,
        });
        // A new consent is rare, so it is the moment to sweep old rows.
        if (this.model === 'Grant') purgeExpired().catch(() => {});
    }

    async find(id) {
        return this.#read({ key: keyOf(this.model, id) });
    }

    async findByUid(uid) {
        return this.#read({ model: this.model, uid });
    }

    // Device flow is off; nothing is stored by user code.
    async findByUserCode() {
        return undefined;
    }

    async consume(id) {
        await LtdOauthModel.update(
            { consumed_at: new Date() },
            { where: { key: keyOf(this.model, id) } }
        );
    }

    async destroy(id) {
        await LtdOauthModel.destroy({ where: { key: keyOf(this.model, id) } });
    }

    async revokeByGrantId(grantId) {
        await LtdOauthModel.destroy({ where: { grant_id: grantId } });
    }

    async #read(where) {
        const row = await LtdOauthModel.findOne({
            where: { ...where, ...live() },
        });
        if (!row) return undefined;
        const payload = decode(row.payload);
        return row.consumed_at
            ? { ...payload, consumed: Math.floor(row.consumed_at / 1000) }
            : payload;
    }
}

// Grants are the user's consent to a client; their rows carry the client id.
const grants = (userId, clientId) =>
    LtdOauthModel.findAll({
        where: {
            model: 'Grant',
            account_id: String(userId),
            ...(clientId ? { client_id: clientId } : {}),
            ...live(),
        },
        order: [['created_at', 'ASC']],
    });

async function hasGrant(userId, clientId) {
    return (await grants(userId, clientId)).length > 0;
}

async function clientsFor(userId) {
    const byClient = new Map();
    for (const grant of await grants(userId)) {
        if (!byClient.has(grant.client_id))
            byClient.set(grant.client_id, grant);
    }
    const clients = await LtdOauthModel.findAll({
        where: {
            key: [...byClient.keys()].map((id) => keyOf('Client', id)),
        },
    });
    const meta = new Map(clients.map((row) => [row.key, decode(row.payload)]));
    return [...byClient.entries()].map(([clientId, grant]) => {
        const client = meta.get(keyOf('Client', clientId)) || {};
        const redirect = (client.redirect_uris || [])[0];
        let host = null;
        try {
            host = redirect ? new URL(redirect).host : null;
        } catch {
            host = null;
        }
        return {
            client_id: clientId,
            name: client.client_name || null,
            redirect_host: host,
            scopes: Object.values(decode(grant.payload).resources || {})
                .join(' ')
                .split(' ')
                .filter(Boolean),
            connected_at: grant.created_at,
        };
    });
}

// Removes the grants and every code and token issued under them.
async function revokeGrants(userId, clientId) {
    const rows = await grants(userId, clientId);
    const ids = rows.map((row) => decode(row.payload).jti);
    if (!ids.length) return 0;
    await LtdOauthModel.destroy({
        where: {
            [Op.or]: [
                { grant_id: ids },
                { key: ids.map((id) => keyOf('Grant', id)) },
            ],
        },
    });
    return ids.length;
}

// ponytail: expired rows are swept when a grant is saved, not on a timer;
// a busy multi-user server would move this to the task scheduler.
async function purgeExpired() {
    await LtdOauthModel.destroy({
        where: { expires_at: { [Op.lt]: new Date() } },
    });
}

module.exports = {
    SequelizeAdapter,
    hasGrant,
    clientsFor,
    revokeGrants,
    purgeExpired,
};
