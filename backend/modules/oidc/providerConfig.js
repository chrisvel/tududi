function parseCommaSeparated(value) {
    if (!value) return [];
    return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
}

function isEnvTrue(value) {
    return (value || '').toLowerCase() === 'true';
}

function normalizeScope(scope) {
    if (!scope) return 'openid profile email';

    const normalized = scope.trim().split(/\s+/).filter(Boolean).join(' ');

    if (!normalized.includes('openid')) {
        console.warn(
            `OIDC scope does not include 'openid'. Adding it automatically. Original scope: "${scope}"`
        );
        return `openid ${normalized}`;
    }

    return normalized;
}

function loadProvidersFromEnv() {
    if (!isEnvTrue(process.env.OIDC_ENABLED)) {
        console.log(
            'OIDC is disabled. Set OIDC_ENABLED=true to enable SSO authentication.'
        );
        return [];
    }

    const providers = [];

    let i = 1;
    while (process.env[`OIDC_PROVIDER_${i}_NAME`]) {
        const provider = {
            slug: process.env[`OIDC_PROVIDER_${i}_SLUG`],
            name: process.env[`OIDC_PROVIDER_${i}_NAME`],
            issuer: process.env[`OIDC_PROVIDER_${i}_ISSUER`],
            clientId: process.env[`OIDC_PROVIDER_${i}_CLIENT_ID`],
            clientSecret: process.env[`OIDC_PROVIDER_${i}_CLIENT_SECRET`],
            scope: normalizeScope(process.env[`OIDC_PROVIDER_${i}_SCOPE`]),
            autoProvision:
                process.env[`OIDC_PROVIDER_${i}_AUTO_PROVISION`] !== 'false',
            adminEmailDomains: parseCommaSeparated(
                process.env[`OIDC_PROVIDER_${i}_ADMIN_EMAIL_DOMAINS`]
            ),
            trustUnverifiedEmail: isEnvTrue(
                process.env[`OIDC_PROVIDER_${i}_TRUST_UNVERIFIED_EMAIL`]
            ),
        };

        const missingFields = [];
        if (!provider.slug) missingFields.push(`OIDC_PROVIDER_${i}_SLUG`);
        if (!provider.name) missingFields.push(`OIDC_PROVIDER_${i}_NAME`);
        if (!provider.issuer) missingFields.push(`OIDC_PROVIDER_${i}_ISSUER`);
        if (!provider.clientId)
            missingFields.push(`OIDC_PROVIDER_${i}_CLIENT_ID`);
        if (!provider.clientSecret)
            missingFields.push(`OIDC_PROVIDER_${i}_CLIENT_SECRET`);

        if (missingFields.length > 0) {
            console.warn(
                `Skipping OIDC provider ${i} due to missing required fields: ${missingFields.join(', ')}`
            );
            i++;
            continue;
        }

        console.log(`Loaded OIDC provider ${i}: ${provider.name}`);
        providers.push(provider);
        i++;
    }

    if (providers.length === 0 && process.env.OIDC_PROVIDER_NAME) {
        const provider = {
            slug: process.env.OIDC_PROVIDER_SLUG || 'default',
            name: process.env.OIDC_PROVIDER_NAME,
            issuer: process.env.OIDC_ISSUER_URL,
            clientId: process.env.OIDC_CLIENT_ID,
            clientSecret: process.env.OIDC_CLIENT_SECRET,
            scope: normalizeScope(process.env.OIDC_SCOPE),
            autoProvision: process.env.OIDC_AUTO_PROVISION !== 'false',
            adminEmailDomains: parseCommaSeparated(
                process.env.OIDC_ADMIN_EMAIL_DOMAINS
            ),
            trustUnverifiedEmail: isEnvTrue(
                process.env.OIDC_TRUST_UNVERIFIED_EMAIL
            ),
        };

        const missingFields = [];
        if (!provider.issuer) missingFields.push('OIDC_ISSUER_URL');
        if (!provider.clientId) missingFields.push('OIDC_CLIENT_ID');
        if (!provider.clientSecret) missingFields.push('OIDC_CLIENT_SECRET');

        if (missingFields.length > 0) {
            console.log(
                `[OIDC] Cannot load provider "${provider.name}": missing required fields: ${missingFields.join(', ')}`
            );
            return [];
        }

        console.log(`Loaded OIDC provider: ${provider.name}`);
        providers.push(provider);
    }

    if (providers.length === 0) {
        console.log(
            '[OIDC] Enabled but no valid providers configured. Check OIDC_PROVIDER_NAME, OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET.'
        );
    }

    return providers;
}

// Providers can also live in the database (see configService.js), set by an
// admin through Profile Settings -> OIDC/SSO instead of .env -- the only way
// to configure OIDC on a hosted instance, where nobody has shell access to
// edit .env and restart. A DB row, once saved, fully replaces the .env
// config (not merged with it); with no row, .env keeps working exactly as
// before. Resolution is cached briefly so the login/callback paths and the
// boot-time isOidcEnabled() check aren't a database hit on every call, while
// still picking up an admin's change without a restart.
const CACHE_TTL_MS = 30 * 1000;
let cache = null; // { value: { enabled, providers }, expires }

async function resolveConfig() {
    if (cache && cache.expires > Date.now()) {
        return cache.value;
    }

    let value;
    try {
        // Required lazily: configService requires this module too, and this
        // keeps that circular require safe (see configService.js).
        const configService = require('./configService');
        const dbConfig = await configService.getDbConfig();
        value = dbConfig
            ? {
                  enabled: dbConfig.enabled,
                  providers: dbConfig.enabled ? dbConfig.providers : [],
              }
            : {
                  enabled: isEnvTrue(process.env.OIDC_ENABLED),
                  providers: loadProvidersFromEnv(),
              };
    } catch (error) {
        console.error(
            'Failed to resolve OIDC config from the database, falling back to environment variables:',
            error.message
        );
        value = {
            enabled: isEnvTrue(process.env.OIDC_ENABLED),
            providers: loadProvidersFromEnv(),
        };
    }

    cache = { value, expires: Date.now() + CACHE_TTL_MS };
    return value;
}

async function getAllProviders() {
    return (await resolveConfig()).providers;
}

async function getProvider(slug) {
    const providers = await getAllProviders();
    return providers.find((p) => p.slug === slug) || null;
}

async function isOidcEnabled() {
    const config = await resolveConfig();
    return config.enabled && config.providers.length > 0;
}

// Clears the cache so the next call re-resolves (DB then env). Synchronous
// and cheap on purpose: it's called un-awaited from the admin save path and
// from ~15 existing test call sites. In a multi-process hosted deployment
// only the process that saved the change picks it up immediately; the
// others catch up within the cache TTL above.
function reloadProviders() {
    cache = null;
}

module.exports = {
    getAllProviders,
    getProvider,
    isOidcEnabled,
    reloadProviders,
    loadProvidersFromEnv,
    isEnvTrue,
    normalizeScope,
    parseCommaSeparated,
};
