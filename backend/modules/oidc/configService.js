'use strict';

// Reads and writes the DB-backed OIDC provider configuration: the
// admin-editable alternative to the OIDC_* / OIDC_PROVIDER_N_* env vars in
// providerConfig.js. Lives in the oidc module (not admin) since it's OIDC
// domain logic; admin/service.js delegates into it the same way it already
// delegates registration toggling into auth/registrationService.js.
//
// Storage: one row in the generic `settings` key/value table (see
// models/setting.js), the same idiom already used for `registration_enabled`
// -- no dedicated table, since nothing ever queries a single provider by SQL.

const { Setting } = require('../../models');
const { logError, logInfo } = require('../../services/logService');
const secretCipher = require('../../shared/crypto/secretCipher');
const { ValidationError } = require('../../shared/errors');

const SETTING_KEY = 'oidc_config';

// The stored row, secrets still encrypted. null when absent or unparseable
// (logged, never thrown -- every caller has an env fallback).
async function readRow() {
    let row;
    try {
        row = await Setting.findOne({ where: { key: SETTING_KEY } });
    } catch (error) {
        logError(error, 'Failed to read OIDC config from the database');
        return null;
    }
    if (!row) return null;

    try {
        const parsed = JSON.parse(row.value);
        return {
            enabled: parsed.enabled === true,
            providers: Array.isArray(parsed.providers) ? parsed.providers : [],
        };
    } catch (error) {
        logError(error, 'Stored OIDC config is not valid JSON');
        return null;
    }
}

// Decrypted, ready-to-use config for the OIDC auth flow (providerConfig.js).
// null on absent/corrupt row, or if a stored secret can't be decrypted (e.g.
// the encryption key changed) -- logged, never thrown.
async function getDbConfig() {
    const raw = await readRow();
    if (!raw) return null;

    try {
        return {
            enabled: raw.enabled,
            providers: raw.providers.map((p) => ({
                ...p,
                clientSecret: secretCipher.decrypt(p.clientSecret),
            })),
        };
    } catch (error) {
        logError(error, 'Failed to decrypt a stored OIDC client secret');
        return null;
    }
}

function maskProvider(provider) {
    const secret = provider.clientSecret || '';
    return {
        slug: provider.slug,
        name: provider.name,
        issuer: provider.issuer,
        clientId: provider.clientId,
        client_secret_set: secret.length > 0,
        client_secret_last4: secret.length >= 4 ? secret.slice(-4) : null,
        scope: provider.scope,
        autoProvision: provider.autoProvision,
        adminEmailDomains: provider.adminEmailDomains || [],
    };
}

// What the admin panel renders: the DB config once one has been saved
// (source: 'db'), or today's .env-derived config as a starting point for
// editing (source: 'env') -- nothing is written to the database until the
// admin explicitly saves. Client secrets are never returned in full.
async function getMaskedConfig() {
    const dbConfig = await getDbConfig();
    if (dbConfig) {
        return {
            source: 'db',
            enabled: dbConfig.enabled,
            providers: dbConfig.providers.map(maskProvider),
        };
    }

    const providerConfig = require('./providerConfig');
    return {
        source: 'env',
        enabled: providerConfig.isEnvTrue(process.env.OIDC_ENABLED),
        providers: providerConfig.loadProvidersFromEnv().map(maskProvider),
    };
}

// Persists a validated config (see admin/validation.js#validateOidcConfig).
// A provider whose clientSecret is omitted keeps whatever secret is already
// stored for that slug -- from the DB row, or, the first time an admin
// saves, from the matching .env provider -- so the admin UI never has to
// round-trip a real secret just to leave it unchanged.
async function saveConfig({ enabled, providers }) {
    const providerConfig = require('./providerConfig');
    const rawRow = await readRow();

    const existingEncryptedBySlug = new Map(
        (rawRow?.providers || []).map((p) => [p.slug, p.clientSecret])
    );
    // Only relevant the first time an admin saves (no DB row yet): carry a
    // matching .env provider's secret over instead of requiring it be
    // retyped.
    const envSecretBySlug = rawRow
        ? new Map()
        : new Map(
              providerConfig
                  .loadProvidersFromEnv()
                  .map((p) => [p.slug, p.clientSecret])
          );

    const encryptOrThrow = (plaintext) => {
        if (!secretCipher.hasKeyMaterial()) {
            throw new ValidationError(
                'Cannot save an OIDC client secret: set TUDUDI_SESSION_SECRET (or TUDUDI_OIDC_SECRET_ENCRYPTION_KEY) on the server first'
            );
        }
        return secretCipher.encrypt(plaintext);
    };

    const storedProviders = providers.map((provider) => {
        const incoming = provider.clientSecret;
        let clientSecret;

        if (typeof incoming === 'string' && incoming.length > 0) {
            clientSecret = encryptOrThrow(incoming);
        } else if (existingEncryptedBySlug.has(provider.slug)) {
            clientSecret = existingEncryptedBySlug.get(provider.slug);
        } else if (envSecretBySlug.has(provider.slug)) {
            clientSecret = encryptOrThrow(envSecretBySlug.get(provider.slug));
        } else {
            throw new ValidationError(
                `Provider "${provider.slug}" is missing a client secret`
            );
        }

        return {
            slug: provider.slug,
            name: provider.name,
            issuer: provider.issuer,
            clientId: provider.clientId,
            clientSecret,
            scope: providerConfig.normalizeScope(provider.scope),
            autoProvision: provider.autoProvision,
            adminEmailDomains: provider.adminEmailDomains || [],
        };
    });

    await Setting.upsert({
        key: SETTING_KEY,
        value: JSON.stringify({ enabled, providers: storedProviders }),
    });

    logInfo(
        `OIDC configuration updated by admin (${storedProviders.length} provider(s), enabled=${enabled})`
    );

    providerConfig.reloadProviders();

    return getMaskedConfig();
}

module.exports = { getDbConfig, getMaskedConfig, saveConfig };
