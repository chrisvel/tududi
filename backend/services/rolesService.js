const { Role, User, sequelize } = require('../models');
const { ValidationError, ForbiddenError } = require('../shared/errors');

const ROLES = ['admin', 'user', 'guest'];
const CAPABILITIES = ['create_people', 'invite_members', 'create_projects'];

const ROLE_DEFAULTS = {
    admin: { create_people: true, invite_members: true, create_projects: true },
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
    return row.role === 'guest' ? 'guest' : 'user';
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
    if (role === 'admin') return capabilities;

    const parsed = parseOverrides(overrides);
    for (const capability of CAPABILITIES) {
        if (typeof parsed[capability] === 'boolean') {
            capabilities[capability] = parsed[capability];
        }
    }
    return capabilities;
}

async function isAdmin(userUidOrId) {
    const userId = await resolveUserId(userUidOrId);
    if (!userId) return false;

    const role = await Role.findOne({ where: { user_id: userId } });
    return !!(role && role.is_admin);
}

async function getRoleInfo(userUidOrId) {
    const userId = await resolveUserId(userUidOrId);
    const row = userId
        ? await Role.findOne({ where: { user_id: userId } })
        : null;
    const role = effectiveRole(row);
    return {
        role,
        capabilities: effectiveCapabilities(role, row && row.capabilities),
    };
}

async function can(userUidOrId, capability) {
    if (!CAPABILITIES.includes(capability)) return false;

    const userId = await resolveUserId(userUidOrId);
    if (!userId) return false;

    const row = await Role.findOne({ where: { user_id: userId } });
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

async function setRole(userUidOrId, role, options = {}) {
    if (!ROLES.includes(role)) {
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
    if (role !== 'admin') {
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

async function describeRoles() {
    const rows = await Role.findAll({ attributes: ['is_admin', 'role'] });
    const totalUsers = await User.count();

    const counts = { admin: 0, user: 0, guest: 0 };
    for (const row of rows) counts[effectiveRole(row)] += 1;
    counts.user += Math.max(0, totalUsers - rows.length);

    return {
        capabilities: [...CAPABILITIES],
        roles: ROLES.map((id) => ({
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
    isAdmin,
    effectiveRole,
    effectiveCapabilities,
    getRoleInfo,
    can,
    assertCan,
    setRole,
    setCapabilities,
    describeRoles,
};
