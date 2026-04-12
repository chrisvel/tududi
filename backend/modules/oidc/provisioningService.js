const { User, OIDCIdentity } = require('../../models');
const providerConfig = require('./providerConfig');
const { sequelize } = require('../../models');

function shouldBeAdmin(config, email) {
    if (!config.adminEmailDomains || config.adminEmailDomains.length === 0) {
        return false;
    }

    const domain = email.split('@')[1];
    return config.adminEmailDomains.includes(domain);
}

function generateUsername(email) {
    const baseUsername = email.split('@')[0];
    return baseUsername.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function findOrCreateIdentity(providerSlug, claims) {
    const identity = await OIDCIdentity.findOne({
        where: {
            provider_slug: providerSlug,
            subject: claims.sub,
        },
        include: [{ model: User, as: 'user' }],
    });

    return identity;
}

async function provisionUser(providerSlug, claims, req) {
    const config = providerConfig.getProvider(providerSlug);
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
            include: [{ model: User, as: 'user' }],
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
            return { user: identity.user, isNewUser: false };
        }

        if (!config.autoProvision) {
            await transaction.rollback();
            throw new Error('Auto-provisioning is disabled for this provider');
        }

        if (!claims.email) {
            await transaction.rollback();
            throw new Error('Email claim is required for provisioning');
        }

        let user = await User.findOne({
            where: { email: claims.email },
            transaction,
        });

        let isNewUser = false;

        if (!user) {
            const username = generateUsername(claims.email);

            user = await User.create(
                {
                    email: claims.email,
                    username,
                    verified_email: true,
                    is_admin: shouldBeAdmin(config, claims.email),
                    password_digest: null,
                },
                { transaction }
            );

            isNewUser = true;
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

        return { user, isNewUser };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function linkIdentityToUser(userId, providerSlug, claims) {
    const config = providerConfig.getProvider(providerSlug);
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
            throw new Error('This OIDC identity is already linked to another user');
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
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    provisionUser,
    linkIdentityToUser,
    findOrCreateIdentity,
    shouldBeAdmin,
    generateUsername,
};
