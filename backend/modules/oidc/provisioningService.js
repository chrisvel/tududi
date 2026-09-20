const { User, OIDCIdentity } = require('../../models');
const providerConfig = require('./providerConfig');
const { sequelize } = require('../../models');
const {
    getDefaultNotificationPreferences,
} = require('../../utils/notificationPreferences');
const peopleService = require('../people/service');
const { logError } = require('../../services/logService');
const { getConfig } = require('../../config/config');
const { OidcUserError } = require('./errors');

function shouldBeAdmin(config, email) {
    if (!config.adminEmailDomains || config.adminEmailDomains.length === 0) {
        return false;
    }

    const domain = String(email || '').split('@')[1];
    if (!domain) return false;

    const wanted = domain.trim().toLowerCase();
    return config.adminEmailDomains.some(
        (allowed) => String(allowed).trim().toLowerCase() === wanted
    );
}

// Some providers send the claim as the string "true".
function isEmailVerified(claims) {
    return claims.email_verified === true || claims.email_verified === 'true';
}

async function findOrCreateIdentity(providerSlug, claims) {
    const identity = await OIDCIdentity.findOne({
        where: {
            provider_slug: providerSlug,
            subject: claims.sub,
        },
        include: [{ model: User, as: 'User' }],
    });

    return identity;
}

async function provisionUser(providerSlug, claims, req) {
    const config = await providerConfig.getProvider(providerSlug);
    if (!config) {
        throw new Error(`Provider not found: ${providerSlug}`);
    }

    const transaction = await sequelize.transaction();

    try {
        let identity = await OIDCIdentity.findOne({
            where: {
                provider_slug: providerSlug,
                subject: claims.sub,
            },
            include: [{ model: User, as: 'User' }],
            transaction,
        });

        if (identity) {
            await identity.update(
                {
                    last_login_at: new Date(),
                    email: claims.email || identity.email,
                    name: claims.name || identity.name,
                    picture: claims.picture || identity.picture,
                    raw_claims: claims,
                },
                { transaction }
            );

            await transaction.commit();
            return { user: identity.User, isNewUser: false };
        }

        if (!config.autoProvision) {
            await transaction.rollback();
            throw new OidcUserError(
                'Auto-provisioning is disabled for this provider'
            );
        }

        if (!claims.email) {
            await transaction.rollback();
            throw new OidcUserError('Email claim is required for provisioning');
        }

        // An email the provider has not verified proves nothing about who
        // holds it. Linking it to an existing account, or creating an account
        // that later receives share invitations sent to that address, would
        // let anyone who can type an address into the provider sign in as its
        // owner. Operators whose provider never sends the claim can opt out
        // per provider (trustUnverifiedEmail).
        if (!config.trustUnverifiedEmail && !isEmailVerified(claims)) {
            await transaction.rollback();
            throw new OidcUserError(
                'Your identity provider has not verified this email address'
            );
        }

        let user = await User.findOne({
            where: { email: String(claims.email).trim().toLowerCase() },
            transaction,
        });

        let isNewUser = false;

        if (!user) {
            // A self-hosted operator who turns on auto-provisioning wants
            // everyone their IdP vouches for to get an account. On a hosted
            // instance the IdP may be a public one (Google, GitHub), so the
            // registration toggle still decides whether new accounts open.
            if (getConfig().hosted?.enabled === true) {
                const {
                    isRegistrationEnabled,
                } = require('../auth/registrationService');
                if (!(await isRegistrationEnabled())) {
                    await transaction.rollback();
                    throw new OidcUserError('Registration is not enabled');
                }
            }

            user = await User.create(
                {
                    email: claims.email,
                    email_verified: true,
                    password_digest: null,
                    notification_preferences:
                        getDefaultNotificationPreferences(),
                },
                { transaction }
            );

            isNewUser = true;

            if (shouldBeAdmin(config, claims.email)) {
                const { Role } = require('../../models');
                await Role.update(
                    { is_admin: true },
                    { where: { user_id: user.id }, transaction }
                );
            }
        }

        identity = await OIDCIdentity.create(
            {
                user_id: user.id,
                provider_slug: providerSlug,
                subject: claims.sub,
                email: claims.email,
                name: claims.name,
                given_name: claims.given_name,
                family_name: claims.family_name,
                picture: claims.picture,
                raw_claims: claims,
                first_login_at: new Date(),
                last_login_at: new Date(),
            },
            { transaction }
        );

        await transaction.commit();

        if (isNewUser) {
            try {
                await peopleService.createSelfPerson(user);
            } catch (err) {
                logError(err, 'Failed to create self-person for new OIDC user');
            }
        }

        return { user, isNewUser };
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }
        throw error;
    }
}

async function linkIdentityToUser(userId, providerSlug, claims) {
    const config = await providerConfig.getProvider(providerSlug);
    if (!config) {
        throw new Error(`Provider not found: ${providerSlug}`);
    }

    const transaction = await sequelize.transaction();

    try {
        const existingIdentity = await OIDCIdentity.findOne({
            where: {
                provider_slug: providerSlug,
                subject: claims.sub,
            },
            transaction,
        });

        if (existingIdentity) {
            if (existingIdentity.user_id === userId) {
                await transaction.commit();
                return existingIdentity;
            }

            await transaction.rollback();
            throw new OidcUserError(
                'This OIDC identity is already linked to another user'
            );
        }

        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            await transaction.rollback();
            throw new Error('User not found');
        }

        const identity = await OIDCIdentity.create(
            {
                user_id: userId,
                provider_slug: providerSlug,
                subject: claims.sub,
                email: claims.email,
                name: claims.name,
                given_name: claims.given_name,
                family_name: claims.family_name,
                picture: claims.picture,
                raw_claims: claims,
                first_login_at: new Date(),
                last_login_at: new Date(),
            },
            { transaction }
        );

        await transaction.commit();
        return identity;
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }
        throw error;
    }
}

module.exports = {
    provisionUser,
    linkIdentityToUser,
    findOrCreateIdentity,
    shouldBeAdmin,
    isEmailVerified,
};
