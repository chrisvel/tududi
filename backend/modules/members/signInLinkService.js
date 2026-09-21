'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, Role, MemberSignInLink } = require('../../models');
const rolesService = require('../../services/rolesService');
const { destroyUserSessions } = require('../../services/sessionService');
const { getConfig } = require('../../config/config');
const {
    NotFoundError,
    ForbiddenError,
    ConflictError,
} = require('../../shared/errors');

// A sign-in link lets a member without an email sign in. The person who made
// the account, or an admin, creates it and hands it over. Only a hash of the
// token is stored, and a link works once.

const INVALID_LINK = 'This sign-in link is not valid or has expired';

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

const capabilitiesOf = (roleRow) => {
    const role = rolesService.effectiveRole(roleRow);
    return {
        role,
        capabilities: rolesService.effectiveCapabilities(
            role,
            roleRow && roleRow.capabilities
        ),
    };
};

// Whether an actor who is not an admin holds every permission the member has.
// Without this, raising a member's permissions later would let whoever created
// the account sign in with more rights than they have themselves.
const withinPermissionsOf = (actorCapabilities, targetCapabilities) =>
    Object.keys(targetCapabilities).every(
        (capability) =>
            !targetCapabilities[capability] || actorCapabilities[capability]
    );

// Can this actor manage links for this account at all: an admin, or whoever
// created it. Anyone else is told the account does not exist, so account ids
// cannot be probed.
function assertMayManage(actorId, target, actorIsAdmin) {
    const mayManage =
        actorIsAdmin ||
        (target &&
            target.created_by_user_id != null &&
            target.created_by_user_id === actorId);
    if (!target || target.id === actorId || !mayManage) {
        throw new NotFoundError('Member not found');
    }
}

function assertEligible(target, targetIsAdmin) {
    if (target.email) {
        throw new ForbiddenError(
            'A sign-in link is only for members without an email'
        );
    }
    if (targetIsAdmin) {
        throw new ForbiddenError('A sign-in link cannot be used for an admin');
    }
}

class SignInLinkService {
    async create(actorId, targetId) {
        const [actorRole, target, targetRole] = await Promise.all([
            Role.findOne({ where: { user_id: actorId } }),
            User.findByPk(targetId),
            Role.findOne({ where: { user_id: targetId } }),
        ]);
        const actorIsAdmin = Boolean(actorRole && actorRole.is_admin);

        assertMayManage(actorId, target, actorIsAdmin);
        assertEligible(target, Boolean(targetRole && targetRole.is_admin));
        if (
            !actorIsAdmin &&
            !withinPermissionsOf(
                capabilitiesOf(actorRole).capabilities,
                capabilitiesOf(targetRole).capabilities
            )
        ) {
            throw new ForbiddenError(
                'That member has permissions you do not have'
            );
        }

        const config = getConfig();
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(
            Date.now() + config.memberSignInLinkExpiryHours * 60 * 60 * 1000
        );

        // One live link per account: a new one replaces the old one. The
        // unique index turns two simultaneous requests into one winner.
        try {
            await sequelize.transaction(async (transaction) => {
                await MemberSignInLink.destroy({
                    where: { user_id: target.id },
                    transaction,
                });
                await MemberSignInLink.create(
                    {
                        user_id: target.id,
                        token_hash: hashToken(token),
                        expires_at: expiresAt,
                        created_by_user_id: actorId,
                    },
                    { transaction }
                );
            });
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError(
                    'A link was just created for this member. Try again.'
                );
            }
            throw err;
        }

        // The path is what the app attaches to the address it is served from,
        // so a link made on a phone or another machine points where the
        // person actually reached the app, not at the configured address.
        const path = `/sign-in-link?token=${token}`;
        return {
            url: `${config.frontendUrl}${path}`,
            path,
            expires_at: expiresAt.toISOString(),
        };
    }

    // Removes the member's live link and signs them out everywhere, so access
    // can be taken back at any time.
    async revoke(actorId, targetId) {
        const [actorRole, target] = await Promise.all([
            Role.findOne({ where: { user_id: actorId } }),
            User.findByPk(targetId),
        ]);
        assertMayManage(actorId, target, Boolean(actorRole?.is_admin));

        await MemberSignInLink.destroy({ where: { user_id: target.id } });
        await destroyUserSessions(target.id);
    }

    async findLiveLink(token) {
        if (
            typeof token !== 'string' ||
            token.length < 16 ||
            token.length > 200
        ) {
            return null;
        }
        return MemberSignInLink.findOne({
            where: {
                token_hash: hashToken(token),
                used_at: null,
                expires_at: { [Op.gt]: new Date() },
            },
            include: [{ model: User, as: 'Member' }],
        });
    }

    // Who a link is for, so the page can ask "Sign in as ...?". Reveals a first
    // name only, and says the same thing for an unknown, used or expired link.
    async peek(token) {
        const link = await this.findLiveLink(token);
        if (!link || !link.Member) throw new NotFoundError(INVALID_LINK);
        return { name: link.Member.name || link.Member.surname || null };
    }

    // Uses the link up and returns the member to sign in. The single UPDATE
    // only matches a link that is still unused and unexpired, so of several
    // simultaneous uses exactly one wins.
    async consume(token) {
        const link = await this.findLiveLink(token);
        const member = link && link.Member;
        if (!member) throw new NotFoundError(INVALID_LINK);

        // The account may have been given an email or made an admin since.
        const memberRole = await Role.findOne({
            where: { user_id: member.id },
        });
        if (member.email || (memberRole && memberRole.is_admin)) {
            throw new NotFoundError(INVALID_LINK);
        }

        const [used] = await MemberSignInLink.update(
            { used_at: new Date() },
            {
                where: {
                    id: link.id,
                    used_at: null,
                    expires_at: { [Op.gt]: new Date() },
                },
            }
        );
        if (used === 0) throw new NotFoundError(INVALID_LINK);

        return { member, issuedByUserId: link.created_by_user_id };
    }

    // For each of the given accounts, whether the actor could create a link for
    // it right now, so the People page only offers the button when it works.
    async issuableAccountIds(actorId, accountIds) {
        const ids = Array.from(new Set(accountIds)).filter(
            (id) => id && id !== actorId
        );
        if (ids.length === 0) return new Set();

        const [actorRole, targets, targetRoles] = await Promise.all([
            Role.findOne({ where: { user_id: actorId } }),
            User.findAll({
                where: { id: { [Op.in]: ids } },
                attributes: ['id', 'email', 'created_by_user_id'],
                raw: true,
            }),
            Role.findAll({ where: { user_id: { [Op.in]: ids } } }),
        ]);
        const actorIsAdmin = Boolean(actorRole && actorRole.is_admin);
        const actorCapabilities = capabilitiesOf(actorRole).capabilities;
        const roleOf = new Map(targetRoles.map((row) => [row.user_id, row]));

        const allowed = new Set();
        for (const target of targets) {
            const targetRole = roleOf.get(target.id);
            if (target.email || (targetRole && targetRole.is_admin)) continue;
            if (!actorIsAdmin) {
                if (target.created_by_user_id !== actorId) continue;
                if (
                    !withinPermissionsOf(
                        actorCapabilities,
                        capabilitiesOf(targetRole).capabilities
                    )
                ) {
                    continue;
                }
            }
            allowed.add(target.id);
        }
        return allowed;
    }
}

module.exports = new SignInLinkService();
