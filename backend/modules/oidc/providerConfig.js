function parseCommaSeparated(value) {
    if (!value) return [];
    return value.split(',').map(v => v.trim()).filter(Boolean);
}

function loadProvidersFromEnv() {
    if (process.env.OIDC_ENABLED !== 'true') {
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
            scope: process.env[`OIDC_PROVIDER_${i}_SCOPE`] || 'openid profile email',
            autoProvision: process.env[`OIDC_PROVIDER_${i}_AUTO_PROVISION`] !== 'false',
            adminEmailDomains: parseCommaSeparated(
                process.env[`OIDC_PROVIDER_${i}_ADMIN_EMAIL_DOMAINS`]
            ),
        };

        if (!provider.slug || !provider.name || !provider.issuer ||
            !provider.clientId || !provider.clientSecret) {
            i++;
            continue;
        }

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
            scope: process.env.OIDC_SCOPE || 'openid profile email',
            autoProvision: process.env.OIDC_AUTO_PROVISION !== 'false',
            adminEmailDomains: parseCommaSeparated(
                process.env.OIDC_ADMIN_EMAIL_DOMAINS
            ),
        };

        if (!provider.issuer || !provider.clientId || !provider.clientSecret) {
            return [];
        }

        providers.push(provider);
    }

    return providers;
}

let cachedProviders = null;

function getAllProviders() {
    if (!cachedProviders) {
        cachedProviders = loadProvidersFromEnv();
    }
    return cachedProviders;
}

function getProvider(slug) {
    const providers = getAllProviders();
    const provider = providers.find(p => p.slug === slug);

    if (!provider) {
        return null;
    }

    return provider;
}

function isOidcEnabled() {
    return process.env.OIDC_ENABLED === 'true' && getAllProviders().length > 0;
}

function reloadProviders() {
    cachedProviders = null;
    return getAllProviders();
}

module.exports = {
    getAllProviders,
    getProvider,
    isOidcEnabled,
    reloadProviders,
};
