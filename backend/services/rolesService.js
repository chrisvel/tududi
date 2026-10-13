const { Op } = require('sequelize');
const { Role, User, sequelize } = require('../models');
const { getConfig } = require('../config/config');
const { ValidationError, ForbiddenError } = require('../shared/errors');

// account_admin exists only on a hosted instance: an admin of one customer
// account (see accountsService), shown as "Admin". There, admin is the
// superadmin who runs the instance, and there is only one.
const ROLES = ['admin', 'account_admin', 'user', 'guest'];
const CAPABILITIES = ['create_people', 'invite_members', 'create_projects'];

const ALL_CAPABILITIES = {
    create_people: true,
    invite_members: true,
    create_projects: true,
};

const ROLE_DEFAULTS = {
    admin: { ...ALL_CAPABILITIES },
    account_admin: { ...ALL_CAPABILITIES },
    user: { create_people: true, invite_members: false, create_projects: true },
    guest: {
        create_people: false,
        invite_members: false,
        create_projects: false,
    },
};

// Accepts either a user's uid (string) or numeric id. Callers pass both, and
// comparing an integer against the varchar uid column is an error on
// PostgreSQL (SQLite silently evaluated it to "no match").
function isHosted() {
    return getConfig().hosted?.enabled === true;
}

function accounts() {
    return require('./accountsService');
}

// The roles that exist on this instance, in the order they are listed.
function availableRoles() {
    return isHosted() ? ROLES : ROLES.filter((r) => r !== 'account_admin');
}

async function resolveUserId(userUidOrId) {
    if (!userUidOrId) return null;
    if (typeof userUidOrId === 'number') return userUidOrId;
    if (/^\d+$/.test(String(userUidOrId))) {
        return parseInt(userUidOrId, 10);
    }
    const user = await User.findOne({
        where: { uid: userUidOrId },
        attributes: ['id'],
    });
    return user ? user.id : null;
}

// is_admin stays the source of truth for admin, so anything that still writes
// only that column behaves as before. The role column tells a user from a
// guest.
function effectiveRole(row) {
    if (!row) return 'user';
    if (row.is_admin) return 'admin';
    if (row.role === 'account_admin') {
        return isHosted() ? 'account_admin' : 'user';
    }
    return row.role === 'guest' ? 'guest' : 'user';
}

function hasFixedCapabilities(role) {
    return role === 'admin' || role === 'account_admin';
}

function parseOverrides(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value) || {};
    } catch {
        return {};
    }
}

function effectiveCapabilities(role, overrides) {
    const capabilities = { ...ROLE_DEFAULTS[role] };
    if (hasFixedCapabilities(role)) return capabilities;

    const parsed = parseOverrides(overrides);
    for (const capability of CAPABILITIES) {
        if (typeof parsed[capability] === 'boolean') {
            capabilities[capability] = parsed[capability];
        }
    }
    return capabilities;
}

// The role row behind a user. On a hosted instance the user is put into an
// account first, which is what makes a new customer an admin of its own.
async function loadRoleRow(userId) {
    if (!userId) return null;
    if (!isHosted()) return Role.findOne({ where: { user_id: userId } });

    await accounts().ensureAccountId(userId);
    const row = await Role.findOne({ where: { user_id: userId } });
    const adminRow = row && (row.is_admin || row.role === 'account_admin');
    // The owner is always an admin of its account, even if its role row was
    // lost or written by something that does not know about accounts.
    if (!adminRow && (await accounts().isOwner(userId))) {
        await accounts().createAccountFor(userId);
        return Role.findOne({ where: { user_id: userId } });
    }
    return row;
}

async function isAdmin(userUidOrId) {
    const userId = await resolveUserId(userUidOrId);
    if (!userId) return false;

    const role = await Role.findOne({ where: { user_id: userId } });
    return !!(role && role.is_admin);
}

async function getRoleInfo(userUidOrId) {
    const userId = await resolveUserId(userUidOrId);
    const row = await loadRoleRow(userId);
    const role = effectiveRole(row);
    return {
        role,
        capabilities: effectiveCapabilities(role, row && row.capabilities),
    };
}

// An admin of a customer account on a hosted instance (the owner, or a member
// made admin). Never the superadmin.
async function isAccountAdmin(userUidOrId) {
    if (!isHosted()) return false;
    const userId = await resolveUserId(userUidOrId);
    const row = await loadRoleRow(userId);
    return effectiveRole(row) === 'account_admin';
}

async function can(userUidOrId, capability) {
    if (!CAPABILITIES.includes(capability)) return false;

    const userId = await resolveUserId(userUidOrId);
    if (!userId) return false;

    const row = await loadRoleRow(userId);
    if (!row) {
        const exists = await User.findByPk(userId, { attributes: ['id'] });
        if (!exists) return false;
    }

    const role = effectiveRole(row);
    return effectiveCapabilities(role, row && row.capabilities)[capability];
}

async function assertCan(userUidOrId, capability) {
    if (!(await can(userUidOrId, capability))) {
        throw new ForbiddenError('Your role does not allow you to do this');
    }
}

// Counts the admins inside the caller's transaction and locks their rows, so
// two people demoting or deleting the last two admins at the same moment
// cannot both pass the check (SQLite has one writer, so it needs no lock).
async function assertAnotherAdminRemains(transaction, message) {
    const admins = await Role.findAll({
        where: { is_admin: true },
        attributes: ['id'],
        order: [['id', 'ASC']],
        lock: transaction.LOCK.UPDATE,
        transaction,
    });
    if (admins.length <= 1) {
        throw new ValidationError(message);
    }
}

// On a hosted instance there is one superadmin, and the owner of a customer
// account is always an admin of it.
async function assertHostedRoleChange(userId, role, transaction) {
    if (!isHosted()) return;
    if (role === 'admin') {
        const others = await Role.count({
            where: { is_admin: true, user_id: { [Op.ne]: userId } },
            transaction,
        });
        if (others > 0) {
            throw new ValidationError('There can be only one superadmin');
        }
        return;
    }
    if (role !== 'account_admin') {
        const owned = await models().Account.count({
            where: { owner_user_id: userId },
            transaction,
        });
        if (owned > 0) {
            throw new ValidationError(
                'The account owner is always an admin of the account'
            );
        }
    }
}

function models() {
    return require('../models');
}

async function setRole(userUidOrId, role, options = {}) {
    if (!availableRoles().includes(role)) {
        throw new ValidationError(`Unknown role: ${role}`);
    }
    const userId = await resolveUserId(userUidOrId);
    if (!userId) throw new ValidationError('Invalid user');

    const inTransaction = (work) =>
        options.transaction
            ? work(options.transaction)
            : sequelize.transaction(work);

    await inTransaction(async (transaction) => {
        const row = await Role.findOne({
            where: { user_id: userId },
            transaction,
        });

        await assertHostedRoleChange(userId, role, transaction);

        if (row && row.is_admin && role !== 'admin') {
            await assertAnotherAdminRemains(
                transaction,
                'Cannot remove the last admin'
            );
        }

        const values = { role, is_admin: role === 'admin' };
        if (row) {
            await row.update(values, { transaction });
        } else {
            await Role.create({ user_id: userId, ...values }, { transaction });
        }
    });
}

// Replaces the account's overrides with the given desired capabilities. Values
// that match the role's defaults are not stored, and an admin has no overrides.
async function setCapabilities(userUidOrId, desired, options = {}) {
    const { transaction } = options;
    const entries = Object.entries(desired || {});
    for (const [capability, value] of entries) {
        if (!CAPABILITIES.includes(capability)) {
            throw new ValidationError(`Unknown capability: ${capability}`);
        }
        if (typeof value !== 'boolean') {
            throw new ValidationError(`${capability} must be true or false`);
        }
    }

    const userId = await resolveUserId(userUidOrId);
    if (!userId) throw new ValidationError('Invalid user');

    const row = await Role.findOne({ where: { user_id: userId }, transaction });
    const role = effectiveRole(row);

    const overrides = {};
    if (!hasFixedCapabilities(role)) {
        for (const [capability, value] of entries) {
            if (value !== ROLE_DEFAULTS[role][capability]) {
                overrides[capability] = value;
            }
        }
    }
    const stored = Object.keys(overrides).length > 0 ? overrides : null;

    if (row) {
        await row.update({ capabilities: stored }, { transaction });
    } else {
        await Role.create(
            {
                user_id: userId,
                role: 'user',
                is_admin: false,
                capabilities: stored,
            },
            { transaction }
        );
    }
}

// The roles and how many accounts hold each. With userIds (an account admin
// looking at its own account) only those users are counted and the
// superadmin role is left out.
async function describeRoles({ userIds = null } = {}) {
    const scoped = Array.isArray(userIds);
    const userWhere = scoped ? { id: { [Op.in]: userIds } } : {};
    const rows = await Role.findAll({
        where: scoped ? { user_id: { [Op.in]: userIds } } : {},
        attributes: ['is_admin', 'role'],
    });
    const totalUsers = await User.count({ where: userWhere });

    const counts = { admin: 0, account_admin: 0, user: 0, guest: 0 };
    for (const row of rows) counts[effectiveRole(row)] += 1;
    counts.user += Math.max(0, totalUsers - rows.length);

    const listed = availableRoles().filter((id) => !(scoped && id === 'admin'));
    return {
        capabilities: [...CAPABILITIES],
        roles: listed.map((id) => ({
            id,
            capabilities: { ...ROLE_DEFAULTS[id] },
            member_count: counts[id],
        })),
    };
}

module.exports = {
    assertAnotherAdminRemains,
    ROLES,
    CAPABILITIES,
    ROLE_DEFAULTS,
    availableRoles,
    isAdmin,
    isAccountAdmin,
    effectiveRole,
    effectiveCapabilities,
    getRoleInfo,
    can,
    assertCan,
    setRole,
    setCapabilities,
    describeRoles,
};
