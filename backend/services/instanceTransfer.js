'use strict';

// Backup and restore of every account on the instance (admins only).
//
// Each account's data goes through the single-account export/import in
// userDataTransfer.js. What only exists between accounts is added here: the
// accounts themselves (with their password hashes, so people can sign in
// after a restore), roles, SSO links, shares and groups.
//
// A restore only adds. An account that already exists (same email, or same
// uid for accounts without an email) is never changed, only filled with the
// records it lacks, so running a restore twice creates nothing new.

const {
    sequelize,
    User,
    Role,
    Person,
    Permission,
    OIDCIdentity,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
    Project,
    Task,
    Note,
    Area,
    Goal,
} = require('../models');
const packageJson = require('../../package.json');
const {
    exportUserData,
    importUserData,
    FORMAT,
} = require('./userDataTransfer');

const KIND = 'instance';

const RESOURCE_MODELS = {
    project: Project,
    task: Task,
    note: Note,
    area: Area,
    goal: Goal,
};

// The key importUserData records resolved uids under, per share resource type.
const RESOURCE_KEYS = {
    project: 'projects',
    task: 'tasks',
    note: 'notes',
    area: 'areas',
    goal: 'goals',
};

const OIDC_FIELDS = [
    'provider_slug',
    'subject',
    'email',
    'name',
    'given_name',
    'family_name',
    'picture',
    'raw_claims',
    'first_login_at',
    'last_login_at',
];

async function exportInstance() {
    const users = await User.findAll({ order: [['id', 'ASC']] });
    const uidOf = Object.fromEntries(users.map((u) => [u.id, u.uid]));
    const [roles, identities] = await Promise.all([
        Role.findAll({ raw: true }),
        OIDCIdentity.findAll({ raw: true }),
    ]);
    const roleOf = Object.fromEntries(roles.map((r) => [r.user_id, r]));

    const accounts = [];
    for (const user of users) {
        const role = roleOf[user.id] || {};
        accounts.push({
            account: {
                uid: user.uid,
                email: user.email,
                name: user.name,
                surname: user.surname,
                password_digest: user.password_digest,
                email_verified: user.email_verified,
                role: role.role || 'user',
                is_admin: !!role.is_admin,
                capabilities: role.capabilities ?? null,
                created_by_user_uid: uidOf[user.created_by_user_id] || null,
                oidc_identities: identities
                    .filter((i) => i.user_id === user.id)
                    .map((i) =>
                        Object.fromEntries(OIDC_FIELDS.map((f) => [f, i[f]]))
                    ),
            },
            backup: await exportUserData(user.id, {
                includeLinkedUsers: true,
            }),
        });
    }

    const shares = (await Permission.findAll({ raw: true }))
        .filter((p) => uidOf[p.user_id])
        .map((p) => ({
            user_uid: uidOf[p.user_id],
            granted_by_user_uid: uidOf[p.granted_by_user_id] || null,
            resource_type: p.resource_type,
            resource_uid: p.resource_uid,
            access_level: p.access_level,
            propagation: p.propagation,
            status: p.status,
        }));

    const groups = [];
    for (const group of await UserGroup.findAll({ raw: true })) {
        const [members, groupShares] = await Promise.all([
            UserGroupMember.findAll({
                where: { group_id: group.id },
                raw: true,
            }),
            GroupShare.findAll({ where: { group_id: group.id }, raw: true }),
        ]);
        const sharePermissions = groupShares.length
            ? await GroupPermission.findAll({
                  where: { group_share_id: groupShares.map((s) => s.id) },
                  raw: true,
              })
            : [];
        groups.push({
            uid: group.uid,
            name: group.name,
            description: group.description,
            created_by_user_uid: uidOf[group.created_by_user_id] || null,
            members: members
                .filter((m) => uidOf[m.user_id])
                .map((m) => ({
                    user_uid: uidOf[m.user_id],
                    added_by_user_uid: uidOf[m.added_by_user_id] || null,
                })),
            shares: groupShares.map((share) => ({
                resource_type: share.resource_type,
                resource_uid: share.resource_uid,
                access_level: share.access_level,
                granted_by_user_uid: uidOf[share.granted_by_user_id] || null,
                permissions: sharePermissions
                    .filter(
                        (p) => p.group_share_id === share.id && uidOf[p.user_id]
                    )
                    .map((p) => ({
                        user_uid: uidOf[p.user_id],
                        access_level: p.access_level,
                        propagation: p.propagation,
                        granted_by_user_uid:
                            uidOf[p.granted_by_user_id] || null,
                        status: p.status,
                    })),
            })),
        });
    }

    return {
        kind: KIND,
        version: packageJson.version,
        format: FORMAT,
        exported_at: new Date().toISOString(),
        accounts,
        shares,
        groups,
    };
}

function validateInstanceBackup(data) {
    const errors = [];
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Backup data is empty'] };
    }
    if (data.kind !== KIND) {
        errors.push('This is not a backup of all accounts');
    }
    if (!data.version) errors.push('Missing version field');
    if (!Array.isArray(data.accounts)) {
        errors.push('Invalid or missing accounts array');
    } else if (data.accounts.some((a) => !a || !a.account || !a.backup?.data)) {
        errors.push('An account entry is incomplete');
    }
    return { valid: errors.length === 0, errors };
}

// Finds the account a backup entry stands for, or creates it.
async function findOrCreateAccount(account, selfPersonBackup, transaction) {
    const email = account.email
        ? String(account.email).trim().toLowerCase()
        : null;
    const existing = email
        ? await User.findOne({ where: { email }, transaction })
        : await User.findOne({ where: { uid: account.uid }, transaction });
    if (existing) return { user: existing, created: false };

    const uidTaken =
        account.uid &&
        (await User.findOne({
            where: { uid: account.uid },
            attributes: ['id'],
            transaction,
        }));

    const user = await User.create(
        {
            ...(account.uid && !uidTaken ? { uid: account.uid } : {}),
            email,
            name: account.name ?? null,
            surname: account.surname ?? null,
            password_digest: account.password_digest || null,
            email_verified: account.email_verified !== false,
        },
        { transaction, skipSelfPerson: !!selfPersonBackup }
    );

    const roleValues = {
        is_admin: !!account.is_admin,
        role: account.role || (account.is_admin ? 'admin' : 'user'),
        capabilities: account.capabilities ?? null,
    };
    const role = await Role.findOne({
        where: { user_id: user.id },
        transaction,
    });
    if (role) await role.update(roleValues, { transaction });
    else
        await Role.create({ user_id: user.id, ...roleValues }, { transaction });

    // The account's own person keeps its uid, so tasks in other accounts
    // that are assigned to this person still point at it.
    if (selfPersonBackup) {
        const personUidTaken = await Person.findOne({
            where: { uid: selfPersonBackup.uid },
            attributes: ['id'],
            transaction,
        });
        await Person.create(
            {
                ...(personUidTaken ? {} : { uid: selfPersonBackup.uid }),
                user_id: user.id,
                linked_user_id: user.id,
                name: selfPersonBackup.name || email || 'Member',
                email,
                relationship_type:
                    selfPersonBackup.relationship_type || 'other',
                phone: selfPersonBackup.phone ?? null,
                notes: selfPersonBackup.notes ?? null,
                color: selfPersonBackup.color ?? null,
                archived: !!selfPersonBackup.archived,
            },
            { transaction }
        );
    }

    return { user, created: true };
}

async function importInstance(backupData) {
    const accounts = backupData.accounts;
    const result = { accounts: [], shares: 0, groups: 0, skipped: [] };
    const userIdByUid = {};
    const createdUsers = [];

    // 1. Accounts, roles, own persons and SSO links, all or nothing.
    const transaction = await sequelize.transaction();
    try {
        for (const entry of accounts) {
            const selfPerson = (entry.backup.data.people || []).find(
                (p) => p.is_self
            );
            const { user, created } = await findOrCreateAccount(
                entry.account,
                selfPerson,
                transaction
            );
            userIdByUid[entry.account.uid] = user.id;
            if (created) createdUsers.push({ user, entry });

            for (const identity of entry.account.oidc_identities || []) {
                const taken = await OIDCIdentity.findOne({
                    where: {
                        provider_slug: identity.provider_slug,
                        subject: identity.subject,
                    },
                    attributes: ['id'],
                    transaction,
                });
                if (taken) continue;
                await OIDCIdentity.create(
                    { ...identity, user_id: user.id },
                    { transaction }
                );
            }

            result.accounts.push({
                email: entry.account.email || null,
                name: entry.account.name || null,
                status: created ? 'created' : 'existing',
            });
        }

        for (const { user, entry } of createdUsers) {
            const creatorId = userIdByUid[entry.account.created_by_user_uid];
            if (creatorId && creatorId !== user.id) {
                await user.update(
                    { created_by_user_id: creatorId },
                    { transaction }
                );
            }
        }

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }

    // The person each account's own card became here, by its backup uid.
    const externalPeople = {};
    for (const entry of accounts) {
        const selfPerson = (entry.backup.data.people || []).find(
            (p) => p.is_self
        );
        if (!selfPerson) continue;
        const userId = userIdByUid[entry.account.uid];
        const current = await Person.findOne({
            where: { user_id: userId, linked_user_id: userId },
            attributes: ['uid'],
            raw: true,
        });
        if (current) externalPeople[selfPerson.uid] = current.uid;
    }

    // 2. Each account's own data.
    const resolvedUids = {};
    for (let i = 0; i < accounts.length; i += 1) {
        const entry = accounts[i];
        const stats = await importUserData(
            userIdByUid[entry.account.uid],
            entry.backup,
            {
                merge: true,
                // An account that was already here keeps its own profile
                restoreProfile: result.accounts[i].status === 'created',
                externalPeople,
                linkedUsers: userIdByUid,
                resolvedUids,
            }
        );
        result.accounts[i].stats = stats;
    }

    const resourceUid = (type, uid) =>
        resolvedUids[RESOURCE_KEYS[type]]?.[uid] || uid;
    const resourceExists = async (type, uid) => {
        const Model = RESOURCE_MODELS[type];
        if (!Model) return false;
        return !!(await Model.findOne({
            where: { uid },
            attributes: ['id'],
            raw: true,
        }));
    };

    // 3. Shares between accounts.
    for (const share of backupData.shares || []) {
        const userId = userIdByUid[share.user_uid];
        const uid = resourceUid(share.resource_type, share.resource_uid);
        if (!userId || !(await resourceExists(share.resource_type, uid))) {
            result.skipped.push({
                type: 'share',
                resource_type: share.resource_type,
                reason: 'account or item missing',
            });
            continue;
        }
        const existing = await Permission.findOne({
            where: {
                user_id: userId,
                resource_type: share.resource_type,
                resource_uid: uid,
            },
            attributes: ['id'],
        });
        if (existing) continue;
        await Permission.create({
            user_id: userId,
            resource_type: share.resource_type,
            resource_uid: uid,
            access_level: share.access_level,
            propagation: share.propagation || 'direct',
            granted_by_user_id: userIdByUid[share.granted_by_user_uid] || null,
            status: share.status || 'accepted',
        });
        result.shares += 1;
    }

    // 4. Groups, their members and what is shared with them.
    for (const group of backupData.groups || []) {
        let row =
            (await UserGroup.findOne({ where: { uid: group.uid } })) ||
            (await UserGroup.findOne({ where: { name: group.name } }));
        if (!row) {
            row = await UserGroup.create({
                uid: group.uid,
                name: group.name,
                description: group.description ?? null,
                created_by_user_id:
                    userIdByUid[group.created_by_user_uid] || null,
            });
            result.groups += 1;
        }

        for (const member of group.members || []) {
            const userId = userIdByUid[member.user_uid];
            if (!userId) continue;
            await UserGroupMember.findOrCreate({
                where: { group_id: row.id, user_id: userId },
                defaults: {
                    added_by_user_id:
                        userIdByUid[member.added_by_user_uid] || null,
                },
            });
        }

        for (const share of group.shares || []) {
            const uid = resourceUid(share.resource_type, share.resource_uid);
            if (!(await resourceExists(share.resource_type, uid))) {
                result.skipped.push({
                    type: 'group share',
                    resource_type: share.resource_type,
                    reason: 'item missing',
                });
                continue;
            }
            const [groupShare] = await GroupShare.findOrCreate({
                where: {
                    group_id: row.id,
                    resource_type: share.resource_type,
                    resource_uid: uid,
                },
                defaults: {
                    access_level: share.access_level,
                    granted_by_user_id:
                        userIdByUid[share.granted_by_user_uid] || null,
                },
            });
            for (const permission of share.permissions || []) {
                const userId = userIdByUid[permission.user_uid];
                if (!userId) continue;
                await GroupPermission.findOrCreate({
                    where: {
                        group_share_id: groupShare.id,
                        user_id: userId,
                        resource_type: share.resource_type,
                        resource_uid: uid,
                    },
                    defaults: {
                        access_level: permission.access_level,
                        propagation: permission.propagation || 'direct',
                        granted_by_user_id:
                            userIdByUid[permission.granted_by_user_uid] || null,
                        status: permission.status || 'accepted',
                    },
                });
            }
        }
    }

    return result;
}

module.exports = {
    KIND,
    exportInstance,
    importInstance,
    validateInstanceBackup,
};
