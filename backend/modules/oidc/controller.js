const oidcService = require('./service');
const provisioningService = require('./provisioningService');
const oidcIdentityService = require('./oidcIdentityService');
const providerConfig = require('./providerConfig');
const auditService = require('./auditService');

async function listProviders(req, res) {
    try {
        const providers = providerConfig.getAllProviders();

        const publicProviders = providers.map((p) => ({
            slug: p.slug,
            name: p.name,
            type: 'oidc',
        }));

        res.json({ providers: publicProviders });
    } catch (error) {
        console.error('Error listing OIDC providers:', error);
        res.status(500).json({ error: 'Failed to list providers' });
    }
}

async function initiateAuth(req, res) {
    try {
        const { slug } = req.params;

        const { authUrl } = await oidcService.initiateAuthFlow(slug, false);

        res.redirect(authUrl);
    } catch (error) {
        console.error('Error initiating OIDC auth:', error);

        const message = error.message || 'Failed to initiate authentication';
        res.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
}

async function handleCallback(req, res) {
    try {
        const { slug } = req.params;

        const result = await oidcService.handleCallback(slug, req.query);

        if (result.linkMode) {
            if (!req.currentUser) {
                return res.redirect(
                    '/login?error=' +
                        encodeURIComponent(
                            'Authentication required to link account'
                        )
                );
            }

            await provisioningService.linkIdentityToUser(
                req.currentUser.id,
                slug,
                result.claims
            );

            await auditService.logOidcLinked(req.currentUser.id, slug, req);

            return res.redirect('/profile/security?success=linked');
        }

        const { user, isNewUser } = await provisioningService.provisionUser(
            slug,
            result.claims,
            req
        );

        req.session.userId = user.id;

        await auditService.logOidcProvision(user.id, slug, req, isNewUser);
        await auditService.logLoginSuccess(
            user.id,
            auditService.AUTH_METHODS.OIDC,
            req,
            slug
        );

        res.redirect('/today');
    } catch (error) {
        console.error('Error handling OIDC callback:', error);

        await auditService.logLoginFailed(
            null,
            auditService.AUTH_METHODS.OIDC,
            req,
            req.params.slug,
            error.message
        );

        const message = error.message || 'Authentication failed';
        res.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
}

async function initiateLink(req, res) {
    try {
        if (!req.currentUser) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { slug } = req.params;

        const { authUrl } = await oidcService.initiateAuthFlow(slug, true);

        res.json({ redirectUrl: authUrl });
    } catch (error) {
        console.error('Error initiating OIDC link:', error);
        res.status(500).json({
            error: error.message || 'Failed to initiate linking',
        });
    }
}

async function unlinkIdentity(req, res) {
    try {
        if (!req.currentUser) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { identityId } = req.params;

        const canUnlink = await oidcIdentityService.canUnlink(
            identityId,
            req.currentUser.id
        );

        if (!canUnlink.canUnlink) {
            return res.status(400).json({ error: canUnlink.reason });
        }

        const identity = await oidcIdentityService.getIdentityById(identityId);

        await oidcIdentityService.unlinkIdentity(
            identityId,
            req.currentUser.id
        );

        await auditService.logOidcUnlinked(
            req.currentUser.id,
            identity.provider_slug,
            req
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error unlinking OIDC identity:', error);
        res.status(500).json({
            error: error.message || 'Failed to unlink identity',
        });
    }
}

async function getUserIdentities(req, res) {
    try {
        if (!req.currentUser) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const identities = await oidcIdentityService.getUserIdentities(
            req.currentUser.id
        );

        const providersMap = {};
        providerConfig.getAllProviders().forEach((p) => {
            providersMap[p.slug] = p;
        });

        const enrichedIdentities = identities.map((identity) => ({
            id: identity.id,
            provider_slug: identity.provider_slug,
            provider_name:
                providersMap[identity.provider_slug]?.name ||
                identity.provider_slug,
            email: identity.email,
            name: identity.name,
            picture: identity.picture,
            first_login_at: identity.first_login_at,
            last_login_at: identity.last_login_at,
            created_at: identity.created_at,
        }));

        res.json({ identities: enrichedIdentities });
    } catch (error) {
        console.error('Error fetching OIDC identities:', error);
        res.status(500).json({ error: 'Failed to fetch identities' });
    }
}

module.exports = {
    listProviders,
    initiateAuth,
    handleCallback,
    initiateLink,
    unlinkIdentity,
    getUserIdentities,
};
