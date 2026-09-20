const oidcService = require('./service');
const provisioningService = require('./provisioningService');
const oidcIdentityService = require('./oidcIdentityService');
const providerConfig = require('./providerConfig');
const auditService = require('./auditService');
const { User } = require('../../models');
const { OidcUserError, toUserMessage } = require('./errors');

// Ties a callback to the browser that started the flow: the random value in
// this cookie is hashed into the stored state, and the callback is refused
// without it. SameSite=Lax still sends it on the top-level redirect back from
// the identity provider. The callback URL is always /api/oidc/callback/:slug
// (see getRedirectUri), whichever base path started the flow.
const BINDING_COOKIE = 'oidc_binding';
const BINDING_COOKIE_PATH = '/api/oidc';
const BINDING_TTL_MS = 10 * 60 * 1000;

function readCookie(req, name) {
    const header = req.headers && req.headers.cookie;
    if (!header) return null;

    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator === -1) continue;
        if (part.slice(0, separator).trim() === name) {
            try {
                return decodeURIComponent(part.slice(separator + 1).trim());
            } catch (_) {
                return null;
            }
        }
    }
    return null;
}

function setBindingCookie(req, res, token) {
    res.cookie(BINDING_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: !!req.secure,
        path: BINDING_COOKIE_PATH,
        maxAge: BINDING_TTL_MS,
    });
}

function clearBindingCookie(res) {
    res.clearCookie(BINDING_COOKIE, { path: BINDING_COOKIE_PATH });
}

function loginErrorRedirect(message) {
    return `/login?error=${encodeURIComponent(message)}`;
}

async function listProviders(req, res) {
    try {
        const providers = await providerConfig.getAllProviders();

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

        const { authUrl, bindingToken } = await oidcService.initiateAuthFlow(
            slug,
            false
        );

        setBindingCookie(req, res, bindingToken);
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error initiating OIDC auth:', error);

        res.redirect(
            loginErrorRedirect(
                toUserMessage(error, 'Failed to initiate authentication')
            )
        );
    }
}

async function handleCallback(req, res) {
    try {
        const { slug } = req.params;

        // The state is single use, so the binding cookie is too.
        const bindingToken = readCookie(req, BINDING_COOKIE);
        clearBindingCookie(res);

        const result = await oidcService.handleCallback(
            slug,
            req.query,
            bindingToken
        );

        if (result.linkMode) {
            // OIDC routes run before the global requireAuth middleware so
            // req.currentUser is never set here; resolve from the session instead.
            const sessionUserId = req.session && req.session.userId;
            if (!sessionUserId) {
                return res.redirect(
                    '/login?error=' +
                        encodeURIComponent(
                            'Authentication required to link account'
                        )
                );
            }

            // The identity is attached to the user who started the link flow,
            // never to whoever happens to be signed in when the callback lands.
            if (
                !result.linkUserId ||
                Number(result.linkUserId) !== Number(sessionUserId)
            ) {
                throw new OidcUserError(
                    'Sign-in session mismatch. Please start again from your profile.'
                );
            }

            const linkUser = await User.findByPk(sessionUserId);
            if (!linkUser) {
                return res.redirect(
                    '/login?error=' +
                        encodeURIComponent(
                            'Authentication required to link account'
                        )
                );
            }

            await provisioningService.linkIdentityToUser(
                linkUser.id,
                slug,
                result.claims
            );

            await auditService.logOidcLinked(linkUser.id, slug, req);

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

        req.session.save((err) => {
            if (err) {
                console.error('Error saving session after OIDC login:', err);
                return res.redirect(
                    '/login?error=' +
                        encodeURIComponent('Failed to establish session')
                );
            }
            res.redirect('/today');
        });
    } catch (error) {
        console.error('Error handling OIDC callback:', error);

        await auditService.logLoginFailed(
            null,
            auditService.AUTH_METHODS.OIDC,
            req,
            req.params.slug,
            error.message
        );

        res.redirect(loginErrorRedirect(toUserMessage(error)));
    }
}

async function initiateLink(req, res) {
    try {
        if (!req.currentUser) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { slug } = req.params;

        const { authUrl, bindingToken } = await oidcService.initiateAuthFlow(
            slug,
            true,
            req.currentUser.id
        );

        setBindingCookie(req, res, bindingToken);
        res.json({ redirectUrl: authUrl });
    } catch (error) {
        console.error('Error initiating OIDC link:', error);
        res.status(500).json({
            error: toUserMessage(error, 'Failed to initiate linking'),
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
        (await providerConfig.getAllProviders()).forEach((p) => {
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
