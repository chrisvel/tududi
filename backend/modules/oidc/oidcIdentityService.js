const { OIDCIdentity, User } = require('../../models');

async function getUserIdentities(userId) {
    return await OIDCIdentity.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        attributes: [
            'id',
            'provider_slug',
            'email',
            'name',
            'picture',
            'first_login_at',
            'last_login_at',
            'created_at',
        ],
    });
}

async function getIdentityById(identityId) {
    return await OIDCIdentity.findByPk(identityId, {
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'username', 'is_admin'],
            },
        ],
    });
}

async function unlinkIdentity(identityId, userId) {
    const identity = await OIDCIdentity.findOne({
        where: {
            id: identityId,
            user_id: userId,
        },
    });

    if (!identity) {
        throw new Error('Identity not found or does not belong to this user');
    }

    const user = await User.findByPk(userId);

    const hasPassword = !!user.password_digest;

    const otherIdentities = await OIDCIdentity.count({
        where: {
            user_id: userId,
            id: { [require('sequelize').Op.ne]: identityId },
        },
    });

    if (!hasPassword && otherIdentities === 0) {
        throw new Error(
            'Cannot unlink the last authentication method. Please set a password first or link another provider.'
        );
    }

    await identity.destroy();

    return true;
}

async function canUnlink(identityId, userId) {
    const identity = await OIDCIdentity.findOne({
        where: {
            id: identityId,
            user_id: userId,
        },
    });

    if (!identity) {
        return { canUnlink: false, reason: 'Identity not found' };
    }

    const user = await User.findByPk(userId);
    const hasPassword = !!user.password_digest;

    const otherIdentities = await OIDCIdentity.count({
        where: {
            user_id: userId,
            id: { [require('sequelize').Op.ne]: identityId },
        },
    });

    if (!hasPassword && otherIdentities === 0) {
        return {
            canUnlink: false,
            reason: 'This is your only authentication method',
        };
    }

    return { canUnlink: true };
}

async function updateIdentityClaims(identityId, claims) {
    const identity = await OIDCIdentity.findByPk(identityId);

    if (!identity) {
        throw new Error('Identity not found');
    }

    await identity.update({
        email: claims.email || identity.email,
        name: claims.name || identity.name,
        given_name: claims.given_name || identity.given_name,
        family_name: claims.family_name || identity.family_name,
        picture: claims.picture || identity.picture,
        raw_claims: claims,
        last_login_at: new Date(),
    });

    return identity;
}

module.exports = {
    getUserIdentities,
    getIdentityById,
    unlinkIdentity,
    canUnlink,
    updateIdentityClaims,
};
