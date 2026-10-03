'use strict';

const { Op } = require('sequelize');
const { getConfig } = require('../config/config');
const { logError } = require('./logService');

// Accounts on a hosted instance. Whoever signs up owns an account and pays
// for it; every member added to it, by the owner or by another admin of the
// account, sits on the owner's subscription. The owner is always an admin of
// the account, and admins may make other members admins. An account never
// sees another account's members or groups. The instance's own admin (the
// superadmin) stands outside this and keeps every power it has.
//
// Self-hosted instances never get here: every function returns early when
// hosted mode is off, so the accounts table stays empty.

const MAX_CREATOR_DEPTH = 10;

function isHosted() {
    return getConfig().hosted?.enabled === true;
}

function models() {
    return require('../models');
}

function roles() {
    return require('./rolesService');
}

// Makes the user the owner of a new account (or of the one it already owns)
// and an admin of it. The superadmin keeps its own role.
async function createAccountFor(userId, { transaction } = {}) {
    const { Account, User, Role } = models();
    const [account] = await Account.findOrCreate({
        where: { owner_user_id: userId },
        defaults: { owner_user_id: userId },
        transaction,
    });
    await User.update(
        { account_id: account.id },
        { where: { id: userId }, transaction, hooks: false }
    );

    const role = await Role.findOne({
        where: { user_id: userId },
        transaction,
    });
    if (!role) {
        await Role.create(
            { user_id: userId, role: 'account_admin', is_admin: false },
            { transaction }
        );
    } else if (!role.is_admin && role.role !== 'account_admin') {
        await role.update({ role: 'account_admin' }, { transaction });
    }
    return account.id;
}

// The account a user belongs to, putting them in one first when they have
// none: a member joins the account of whoever created it, anyone else owns a
// new one. Accounts the superadmin creates stand on their own, since those
// are customers, not the superadmin's family.
async function ensureAccountId(userId, { transaction, depth = 0 } = {}) {
    if (!isHosted() || !userId) return null;
    const { User } = models();
    const user = await User.findByPk(userId, {
        attributes: ['id', 'account_id', 'created_by_user_id'],
        transaction,
    });
    if (!user) return null;
    if (user.account_id) return user.account_id;

    const creatorId = user.created_by_user_id;
    if (
        creatorId &&
        creatorId !== user.id &&
        depth < MAX_CREATOR_DEPTH &&
        !(await roles().isAdmin(creatorId))
    ) {
        const accountId = await ensureAccountId(creatorId, {
            transaction,
            depth: depth + 1,
        });
        if (accountId) {
            await User.update(
                { account_id: accountId },
                { where: { id: user.id }, transaction, hooks: false }
            );
            return accountId;
        }
    }
    return createAccountFor(user.id, { transaction });
}

async function getAccount(userId, options = {}) {
    const accountId = await ensureAccountId(userId, options);
    if (!accountId) return null;
    return models().Account.findByPk(accountId, {
        transaction: options.transaction,
    });
}

// Who pays for the user's seat: the owner of its account. Without hosted
// mode, or without an account, the user itself.
async function getOwnerId(userId, options = {}) {
    const account = await getAccount(userId, options);
    return account ? account.owner_user_id : userId;
}

async function isOwner(userId) {
    if (!isHosted() || !userId) return false;
    const account = await models().Account.findOne({
        where: { owner_user_id: userId },
        attributes: ['id'],
    });
    return Boolean(account);
}

async function getUserIds(accountId) {
    if (!accountId) return [];
    const rows = await models().User.findAll({
        where: { account_id: accountId },
        attributes: ['id'],
        raw: true,
    });
    return rows.map((row) => row.id);
}

// Everyone in the same account as the user, the user included.
async function getAccountUserIds(userId) {
    const accountId = await ensureAccountId(userId);
    return accountId ? getUserIds(accountId) : [];
}

// The members an owner pays for: everyone in its account but itself.
async function countMembers(ownerId) {
    const account = await models().Account.findOne({
        where: { owner_user_id: ownerId },
        attributes: ['id'],
    });
    if (!account) return 0;
    return models().User.count({
        where: { account_id: account.id, id: { [Op.ne]: ownerId } },
    });
}

// The accounts an admin of a customer account may manage: everyone else in
// its account except the owner. Empty for anyone who is not an account admin.
async function managedUserIds(actorId) {
    if (!isHosted() || !actorId) return new Set();
    if (!(await roles().isAccountAdmin(actorId))) return new Set();
    const account = await getAccount(actorId);
    if (!account) return new Set();
    const ids = await getUserIds(account.id);
    return new Set(
        ids.filter((id) => id !== actorId && id !== account.owner_user_id)
    );
}

async function managesUser(actorId, targetId) {
    return (await managedUserIds(actorId)).has(targetId);
}

// When an owner's account is erased its account goes too. Its members stay
// and are put into accounts of their own the next time they are looked at.
async function releaseOwnedAccount(userId, { transaction } = {}) {
    const { Account, User, UserGroup } = models();
    const account = await Account.findOne({
        where: { owner_user_id: userId },
        transaction,
    });
    if (!account) return;
    await User.update(
        { account_id: null },
        { where: { account_id: account.id }, transaction, hooks: false }
    );
    await UserGroup.update(
        { account_id: null },
        { where: { account_id: account.id }, transaction }
    );
    await account.destroy({ transaction });
}

// Puts every user and group that has no account yet into one. Runs when a
// hosted instance starts; does nothing on a self-hosted one. Safe to run
// again: whatever is already in an account is left alone.
async function backfill() {
    if (!isHosted()) return { users: 0, groups: 0 };
    const { User, UserGroup } = models();

    const users = await User.findAll({
        where: { account_id: null },
        attributes: ['id'],
        order: [['id', 'ASC']],
        raw: true,
    });
    let placedUsers = 0;
    for (const { id } of users) {
        try {
            if (await ensureAccountId(id)) placedUsers += 1;
        } catch (error) {
            logError(error, `Could not put user ${id} into an account`);
        }
    }

    const groups = await UserGroup.findAll({
        where: {
            account_id: null,
            created_by_user_id: { [Op.ne]: null },
        },
    });
    let placedGroups = 0;
    for (const group of groups) {
        try {
            const accountId = await ensureAccountId(group.created_by_user_id);
            if (accountId) {
                await group.update({ account_id: accountId });
                placedGroups += 1;
            }
        } catch (error) {
            logError(error, `Could not put group ${group.id} into an account`);
        }
    }

    return { users: placedUsers, groups: placedGroups };
}

module.exports = {
    isHosted,
    createAccountFor,
    ensureAccountId,
    getAccount,
    getOwnerId,
    isOwner,
    getUserIds,
    getAccountUserIds,
    countMembers,
    managedUserIds,
    managesUser,
    releaseOwnedAccount,
    backfill,
};
